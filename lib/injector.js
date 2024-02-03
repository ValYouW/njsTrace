var util = require('util'),
	esparse = require('./esparse.js'),
	Syntax = require('./syntax.js');

var TRACE_ENTRY = 'var __njsEntryData__ = __njsTraceEntry__({file: %s, name: %s, line: %s, args: %s});';
var TRACE_EXIT = '__njsTraceExit__({entryData: __njsEntryData__, exception: %s, line: %s, returnValue: %s});';
var ON_CATCH = 'if (__njsOnCatchClause__) {\n__njsOnCatchClause__({entryData: __njsEntryData__});\n}';

/**
 * Creates a new instance of Instrumentation "class"
 * @class Provides instrumentation functionality
 * @param {NJSTrace} njsTrace - A reference to an NJSTrace object
 * @constructor
 */
function Injector(njsTrace) {
	this.njs = njsTrace;
}

/**
 * Returns whether the given node is a function node
 * @param {Object} node - The node to check
 * @returns {boolean}
 */
Injector.prototype.isFunctionNode = function(node) {
	return (node.type === Syntax.FunctionDeclaration || node.type === Syntax.FunctionExpression || node.type === Syntax.ArrowFunctionExpression) && node.range;
};

/**
 * Gets the function name (if this node is a function node).
 * @param {object} node - The falafel AST node
 * @returns {string} The function name
 */
Injector.prototype.getFunctionName = function(node) {
	// Make sure this is a function node.
	if (!this.isFunctionNode(node)) {
		return;
	}

	// Not all functions have ids (i.e Anonymous functions), in case we do have id we can get it and stop.
	if (node.id) {
		return node.id.name;
	}

	// FunctionDeclaration (function foo(){...}) should ALWAYS have id,
	// so in case this is FunctionDeclaration and it had no id it's an error.
	if (node.type === Syntax.FunctionDeclaration) {
		this.njs.emit(this.njs.prototype.events.Error, new Error('A FunctionDeclaration node has no id data, node:' + JSON.stringify(node)));
		return '';
	}

	// So this is an anonymous FunctionExpression, we try to get a name using the parent data,
	// for example in case of: var foo = function(){}, the name would be foo.
	var parent = node.parent;
	switch (parent.type) {
		// var f; f = function () {...}
		case Syntax.AssignmentExpression:
			// Extract the variable name
			if (parent.left.range) {
				return parent.left.source().replace(/"/g, '\\"');
			}
			break;

		// var f = function(){...}
		case Syntax.VariableDeclarator:
			return parent.id.name;

		// IIFE (function(scope) {})(module);
		case Syntax.CallExpression:
			return parent.callee.id ? parent.callee.id.name : '[Anonymous]';

		// Don't give up, can still find
		default:
			// Happens when a function is passed as an argument foo(function() {...})
			if (typeof parent.length === 'number') {
				return parent.id ? parent.id.name : '[Anonymous]';
				// Not sure when this happens...
			} else if (parent.key && parent.key.type === 'Identifier' &&
				parent.value === node && parent.key.name) {
				return parent.key.name;
			}
	}

	return '[Anonymous]';
};

/**
 * Checks whether this node belongs to Node's wrapper function (the top level function that wraps every Node's module)
 * @param {object} node - The falafel AST node
 * @returns {boolean}
 */
Injector.prototype.isOnWrapperFunction = function(node) {
	var parent = node.parent;
	while (parent) {
		if (this.isFunctionNode(parent)) {
			return parent.loc.start.line === 1;
		}

		parent = parent.parent;
	}

	return true;
};

/**
 * Inject njsTrace tracing functions into the given code text
 * @param {string} filename - The file being instrumented
 * @param {string} code - The JS code to trace
 * @param {Boolean} wrapFunctions - Whether to wrap functions in try/catch
 * @param {boolean} includeArguments - Whether a traced function arguments and return values should be passed to the tracer
 * @param {boolean} wrappedFile - Whether this entire file is wrapped in a function (i.e like node is wrapping the modules in a function)
 * @returns {string} The modified JS code text
 */
Injector.prototype.injectTracing = function(filename, code, wrapFunctions, includeArguments, wrappedFile) {
	var self = this;
	var traceExit;
	var output = esparse(code, {range: true, loc: true, ecmaVersion: this.njs.config.ecmaVersion}, function processASTNode(node) {
		// In wrapped files the first line is the wrapper function so we need to offset location to get the real lines in user-world
		var startLine = wrappedFile ? node.loc.start.line - 1 : node.loc.start.line;
		var retLine = wrappedFile ? node.loc.end.line - 1 : node.loc.end.line;

		// If we have name this is a function
		var name = self.getFunctionName(node);
		if (name) {
			self.njs.log('  Instrumenting ', name, 'line:', node.loc.start.line);

			// Empty arrow functions are NOT BlockStatements (i.e "() => i")
			var isBlockStatement = (node.body.type === Syntax.BlockStatement);

			// Separate the function declaration ("function foo") from function body ("{...}")
			var funcDec = node.source().slice(0, node.body.range[0] - node.range[0]);
			var origFuncBody = node.body.source();
			if (isBlockStatement) {
				// Remove the open and close braces "{}"
				origFuncBody = origFuncBody.slice(1, origFuncBody.length - 1);
			} else {
				// Take the part of the function declaration only till the "=>" (i.e if it's "res => ({x:123})" ignore the "(" )
				var idx = funcDec.indexOf('=>');
				if (idx > 0) {
					funcDec = funcDec.substring(0, idx + 2);
				}

				// This function is not BlockStatement, meaning what we have as the function body is just
				// a return value. Convert it to a BlockStatement function that just return that value, so
				// we can put our injection code inside that function.

				var rLine = wrappedFile ? node.body.loc.start.line - 1 : node.body.loc.start.line; // return line of our func
				var tmpVar = '__njsTmp' + Math.floor(Math.random() * 10000) + '__'; // hold the return value

				var exitTrace = util.format(TRACE_EXIT, 'false', rLine, includeArguments ? tmpVar : 'null');

				// The new function body, just return the value represented by the arrow function
				origFuncBody = '\nvar ' + tmpVar + ' = (' + origFuncBody + ');\n' + exitTrace + '\nreturn ' + tmpVar + ';\n';
			}

			// If this file is wrapped in a function and this is the first line, it means that this is the call
			// to the file wrapper function, in this case we don't want to instrument it (as this function is hidden from the user and also creates a mess with async/await)
			// In reality it means that this is the function that Node is wrapping all the modules with and call it when
			// the module is being required.
			if (wrappedFile && node.loc.start.line === 1) {return;}

			var args = 'null';
			if (includeArguments) {
				args = '[' + node.params.map(p => {
					if (p.type === Syntax.RestElement) {
						return p.argument.name;
					}

					return p.name;
				}).join(',') + ']';
			}

			// put our TRACE_ENTRY as the first line of the function and TRACE_EXIT as last line
			var traceEntry = util.format(TRACE_ENTRY, JSON.stringify(filename), JSON.stringify(name), startLine, args);
			traceExit = util.format(TRACE_EXIT, 'false', retLine, 'null');

			var newFuncBody = '\n' + traceEntry + '\n' + origFuncBody + '\n' + traceExit + '\n';

			if (wrapFunctions) {
				var traceEX = util.format(TRACE_EXIT, 'true', startLine, 'null');
				node.update(funcDec + '{\ntry {' + newFuncBody + '} catch(__njsEX__) {\n' + traceEX + '\nthrow __njsEX__;\n}\n}');
			} else {
				node.update(funcDec + '{' + newFuncBody + '}');
			}

		// If this is a return statement we should trace exit
		} else if (node.type === Syntax.ReturnStatement && (!wrappedFile || !self.isOnWrapperFunction(node))) {
			// If this return stmt has some argument (e.g return XYZ;) we will put this argument in a helper var, do our TRACE_EXIT,
			// and return the helper var. This is because the return stmt could be a function call and we want
			// to make sure that our TRACE_EXIT is definitely the last call.
			if (node.argument) {
				// Use a random variable name
				var tmpVar = '__njsTmp' + Math.floor(Math.random() * 10000) + '__';

				// We wrap the entire thing in a new block for cases when the return stmt is not in a block (i.e "if (x>0) return;").
				traceExit = util.format(TRACE_EXIT, 'false', startLine, includeArguments ? tmpVar : 'null');
				node.update('{\nvar ' + tmpVar + ' = (' + node.argument.source() + ');\n' + traceExit + '\nreturn ' + tmpVar + ';\n}');
			} else {
				traceExit = util.format(TRACE_EXIT, 'false', startLine, 'null');
				node.update('{' + traceExit + node.source() + '}');
			}

		// Let the app know that there was an exception so it can adjust the stack trace or whatever
		} else if (node.type === Syntax.CatchClause && (!wrappedFile || !self.isOnWrapperFunction(node))) {
			var origCatch = node.body.source();
			origCatch = origCatch.slice(1, origCatch.length - 1); // Remove the open and close braces "{}"
			node.body.update('{\n' + ON_CATCH + '\n' + origCatch + '\n}');
		}
	});

	return output.toString();
};

module.exports = Injector;
