var esprima = require('esprima');

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
 * @callback Injector~onTraverse
 * @param {Object} node - The node being inspected
 * @param {Object[]} parents - The inspected node's parents
 */

 /**
 * Recursively iterates thru the compiled node structure and raise a callback on each chile node
 * @param {object} node - The node to traverse
 * @param {Injector~onTraverse} cb - A callback to be called on each child node
 * @param {Object[]} parents - An array of all parents of this node
 */
Injector.prototype.traverse = function(node, cb, parents) {
	var child;

	parents = parents || [];
	cb.call(this, node, parents);

	// Get all the properties of node and loop thru them
	var keys = Object.getOwnPropertyNames(node);
	for (var i = 0; i < keys.length; ++i) {
		child = node[keys[i]];

		// If this child is an object call traverse on it as well and add this node as its parent
		if (typeof child === 'object' && child !== null) {
			this.traverse(child, cb, [node].concat(parents));
		}
	}
};

/**
 * Returns whether the given node is a function node
 * @param {Object} node - The node to check
 * @returns {boolean}
 */
Injector.prototype.isFunctionNode = function(node) {
	return (node.type === esprima.Syntax.FunctionDeclaration || node.type === esprima.Syntax.FunctionExpression) &&
			node.range;
};

/**
 * Returns all the exit statements of this function node
 * @param {Object} fnNode - The function node to check
 * @returns {Object[]} An array containing all return statements (including the closing bracket of the function)
 */
Injector.prototype.findFunctionExit = function(fnNode) {
	if (!this.isFunctionNode(fnNode)) {
		// Throw error as this should not happen
		throw new Error('Injector.prototype.findFunctionExit must be called with a function node');
	}

	var exits = [];

	// Start digging into the function structure looking for return statements.
	this.traverse(fnNode, function (node, path) {
		var i, parent;
		if (node.type === esprima.Syntax.ReturnStatement) {
			// It is possible that this return statement belongs to some other inner function,
			// so we are looking thru the parents of this statement for its owning function,
			// if this is our fnNode function - good, otherwise ignore this return statement.
			for (i = 0; i < path.length; ++i) {
				parent = path[i];
				if (this.isFunctionNode(parent)) {
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
};

/**
 * Gets all the function statements of the given code text
 * @param {string} code - The JS doc to inspect
 * @returns {Object[]} An array with all function statements
 */
Injector.prototype.getFunctions = function(code) {
	var functionList = [];

	// Parse the code and start to traverse over all its nodes
	var tree = esprima.parse(code, { range: true, loc: true });
	this.traverse(tree, function (node, parents) {
		// Make sure this is a function node.
		if (!this.isFunctionNode(node)) {
			return;
		}

		// Hold the function data.
		var fnData = { name: '', node: node, exits: this.findFunctionExit(node) };

		// Not all functions have ids (i.e Anonymous functions), in case we do have id we can get it and stop.
		if (node.id) {
			fnData.name = node.id.name;
			functionList.push(fnData);
			return;
		}

		// FunctionDeclaration (function foo(){...}) should ALWAYS have id,
		// so in case this is FunctionDeclaration and it had no id it's an error.
		if (node.type === esprima.Syntax.FunctionDeclaration) {
			this.njs.emit(this.njs.prototype.events.Error, new Error('A FunctionDeclaration node has no id data, node:' + JSON.stringify(node)));
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
			this.njs.emit(this.njs.prototype.events.Warn, msg);
		}
	});

	return functionList;
};

/**
 * Inject njsTrace tracing functions into the given code text
 * @param {string} code - The JS code to trace
 * @returns {string} The modified JS code text
 */
Injector.prototype.injectTracing = function(filename, code) {
	this.njs.log('Get all functions from:', filename);
	var functionList = this.getFunctions(code);
	this.njs.log('\tFound %s functions, injecting trace...', functionList.length);

	// Insert the instrumentation code from the last entry.
	// This is to ensure that the range for each entry remains valid)
	// (it won't shift due to some new inserting string before the range).
	for (var i = functionList.length - 1; i >= 0; i -= 1) {
		var func = functionList[i];
		this.njs.log('\t\t%s::%s, exits:', func.name, func.node.loc.start.line, func.exits.length);
//		var param = {
//			name: functionList[i].name,
//			range: functionList[i].node.range,
//			loc: functionList[i].node.loc
//		};

		var signature = '__njsTraceStart__({file:' + JSON.stringify(filename) + ', ' +
											'name:' + JSON.stringify(func.name) + ', ' +
											'line:' + func.node.loc.start.line + ', ' +
											'args: arguments' +
											'});';

		var pos = functionList[i].node.body.range[0] + 1;
		code = code.slice(0, pos) + '\n' + signature + '\n' + code.slice(pos, code.length);
	}

	return code;
};

module.exports = Injector;