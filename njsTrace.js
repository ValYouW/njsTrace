var esprima = require('esprima'),
	Module = require('module'),
	EventEmitter = require('events').EventEmitter;

var emitter = new EventEmitter();

function traverse(node, cb, parents) {
	var child;

	parents = parents || [];
	cb(node, parents);

	var keys = Object.getOwnPropertyNames(node);
	for (var i = 0; i < keys.length; ++i) {
		child = node[keys[i]];
		if (typeof child === 'object' && child !== null) {
			traverse(child, cb, [node].concat(parents));
		}
	}
}

function isFunctionNode(fnNode) {
	return (fnNode.type === esprima.Syntax.FunctionDeclaration || fnNode.type === esprima.Syntax.FunctionExpression) &&
			fnNode.range;
}

function findFunctionExit(fnNode) {
	var exits = [];

	// Start digging into the function structure looking for return statements.
	traverse(fnNode, function (node, path) {
		var i, parent;
		if (node.type === esprima.Syntax.ReturnStatement) {
			// It is possible that this return statement belongs to some other inner function,
			// so we are looking thru the parents of this statement for its owning function,
			// if this is our fnNode function - good, otherwise ignore this return statement.
			for (i = 0; i < path.length; ++i) {
				parent = path[i];
				if (isFunctionNode(parent)) {
					if (parent.range === fnNode.range) {
						// Push the beginning of the return statement
						exits.push(node.range[0]);
					}
					break;
				}
			}
		}
	});

	// All functions also return at the end of the function, range[1] gives 1 char after the
	// closing bracket of the function ("}"), so we adjust the exit to be exactly the closing bracket.
	exits.push(fnNode.range[1]-1);
	return exits;
}

function getFunctions(code) {
	var functionList = [];

	// Parse the code and start to traverse over all its nodes
	var tree = esprima.parse(code, { range: true, loc: true });
	traverse(tree, function (node, parents) {
		// Make sure this is a function node.
		if (!isFunctionNode(node)) {
			return;
		}

		// Hold the function data.
		var fnData = { name: '', node: node, exits: findFunctionExit(node) };

		// Not all functions have ids (i.e Anonymous functions), in case we do have id we can get it and stop.
		if (node.id) {
			fnData.name = node.id.name;
			functionList.push(fnData);
			return;
		}

		// FunctionDeclaration (function foo(){...}) should ALWAYS have id,
		// so in case this is FunctionDeclaration and it had no id it's an error.
		if (node.type === esprima.Syntax.FunctionDeclaration) {
			emitter.on(JsTrace.events.Error, new Error('A FunctionDeclaration node has no id data, node:' + JSON.stringify(node)));
			return;
		}

		// So this is an anonymous FunctionExpression, we try to get a name using the parent data,
		// for example in case of: var foo = function(){}, the name would be foo.
		var parent = parents[0];
		switch (parent.type) {
			// var f; f = function () {...}
			case esprima.Syntax.AssignmentExpression:
				// Extract the variable name
				if (parent.left.range) {
					fnData.name = code.slice(parent.left.range[0], parent.left.range[1]).replace(/"/g, '\\"');
				}

				break;

			// var f = function(){...}
			case esprima.Syntax.VariableDeclarator:
				fnData.name = parent.id.name;
				break;

			// IIFE (function(scope) {})(module);
			case esprima.Syntax.CallExpression:
				fnData.name = parent.callee.id ? parent.callee.id.name : '[Anonymous]';
				break;

			// Don't give up, can still find
			default:
				// Happens when a function is passed as an argument foo(function() {...})
				if (typeof parent.length === 'number') {
					fnData.name = parent.id ? parent.id.name : '[Anonymous]';
				// Not sure when this happens...
				} else if (parent.key && parent.key.type === 'Identifier' &&
							parent.value === node && parent.key.name) {
					fnData.name = parent.key.name;
				}
		}

		// If no name ignore this function, this is interesting situation so ask users to report about it
		// until I will understand why it is... :-)
		if (fnData.name) {
			functionList.push(fnData);
		} else {
			var msg = 'Could not find a name for a FunctionExpression node based on the parent' +
						', please report so we can check it... Node: ' + JSON.stringify(node) +
						', Parent: ' + JSON.stringify(parent);
			emitter.on(JsTrace.events.Warn, msg);
		}
	});

	return functionList;
}

function injectTracing(code) {
	var functionList = getFunctions(code);

	// Insert the instrumentation code from the last entry.
	// This is to ensure that the range for each entry remains valid)
	// (it won't shift due to some new inserting string before the range).
	for (var i = functionList.length - 1; i >= 0; i -= 1) {
		console.log(functionList[i].name, '-->', functionList[i].exits );
		var param = {
			name: functionList[i].name,
			range: functionList[i].node.range,
			loc: functionList[i].node.loc
		};

		var signature = '__jswTraceStart({});';

		var pos = functionList[i].node.body.range[0] + 1;
		code = code.slice(0, pos) + '\n' + signature + '\n' + code.slice(pos, code.length);
	}

	return code;
}

var origCompile = Module.prototype._compile;
Module.prototype._compile = function(content, filename) {
	console.log('Compiling:', filename);
	//var s = removeComments(content);
	//console.log(s);

	content = injectTracing(content);
	console.log(content);

	origCompile.call(this, content, filename);
};

global.__jsTrace__ = function() {
	//console.log('TRACE:', arguments);
};

var JsTrace = module.exports = {};
JsTrace.events = {
	Error: 'error',
	Warn: 'warn'
};

JsTrace.on = function(event ,cb) {
	emitter.on(event, cb);
};

JsTrace.once = function(event ,cb) {
	emitter.once(event, cb);
};

JsTrace.removeListener = function(event ,cb) {
	emitter.removeListener(event, cb);
};