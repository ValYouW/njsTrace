var	util = require('util'),
	idgen = require('idgen');

/**
 * Handling all the tracing and profiling collection
 * @param {Formatter|Formatter[]} formatters - A list of formatters to use as output
 * @constructor
 */
function Tracer(formatters) {
	/**
	 * @type {Tracer.CallStack}
	 */
	this.stack = [];

	this.stack.stackMap = {};
	this.formatters = formatters || [];
	if (!util.isArray(this.formatters)) {
		this.formatters = [this.formatters];
	}

	// Create the 2 arguments objects we would pass to the formatters
	this.onEntryArgs = { name: '', file: '', line: 0, args: null, stack: null };
	this.onExitArgs = { name: '', file: '', line: 0, retLine: 0, span: 0, stack: null, exception: false, returnValue: null };
}

/**
 * Called on functions entry
 * @param {NJSTrace.functionEntryArgs} args - The event args
 * @returns {Object} An object that will be passed as argument to the onExit function
 * @protected
 */
Tracer.prototype.onEntry = function(args) {
	var stackFrame = args.name + '@' + args.file + '::' + args.line;
	var sid = this.pushFrame(stackFrame);

	// We are recycling the same args object again and again to ease on GC
	// This means that the formatters should NOT keep a reference to this object in some async callback as it will change
	this.onEntryArgs.name = args.name;
	this.onEntryArgs.file = args.file;
	this.onEntryArgs.line = args.line;
	this.onEntryArgs.args = args.args;
	this.onEntryArgs.stack = this.stack;

	for (var i = 0; i < this.formatters.length; ++i) {
		this.formatters[i].onEntry(this.onEntryArgs);
	}

	// This would be the args.entryData on the onExit function
	return {name: args.name, file: args.file, fnLine: args.line, ts: Date.now(), stackId: sid};
};

/**
 * Called on functions exit
 * @param {NJSTrace.functionExitArgs} args - The event args
 * @protected
 */
Tracer.prototype.onExit = function(args) {
	var ts = Date.now() - args.entryData.ts;
	this.popFrame(args.entryData.stackId);

	// We are recycling the same args object again and again to ease on GC
	// This means that the formatters should NOT keep a reference to this object in some async callback as it will change
	this.onExitArgs.name = args.entryData.name;
	this.onExitArgs.file = args.entryData.file;
	this.onExitArgs.line = args.entryData.fnLine;
	this.onExitArgs.retLine = args.line;
	this.onExitArgs.span = ts;
	this.onExitArgs.stack = this.stack;
	this.onExitArgs.exception = args.exception;
	this.onExitArgs.returnValue = args.returnValue;

	for (var i = 0; i < this.formatters.length; ++i) {
		this.formatters[i].onExit(this.onExitArgs);
	}
};

/**
 * Called when the code hits a "catch" clause (i.e in try-catch).
 * @param {NJSTrace.catchClauseArgs} args - The event args
 * @protected
 */
Tracer.prototype.onCatchClause = function(args) {
	// We hit a catch clause, check if we need to adjust the call stack due to the exception that happened.
	// args.entryData is of the function where the "catch" is, so this function should be the top of the stack now.
	if (!args.entryData.stackId) {
		// This should not happen, make sure the user get the message
		console.error('njsTrace: Got entryData with no stackId, that is weird, please report...');
		return;
	}

	// Peek at the top of the stack and pop if it is not the current executing stackId
	var currStackId = this.stack[this.stack.length - 1];
	while (currStackId && currStackId !== args.entryData.stackId) {
		currStackId = this.stack.pop();
		currStackId = this.stack[this.stack.length - 1];
	}
};

/**
 * Push a frame into the call stack
 * @param {String} stackFrame - The frame id to push
 * @returns {String} The assigned stack id
 * @private
 */
Tracer.prototype.pushFrame = function(stackFrame) {
	// Need a unique id for a stack (in case of recursive calls the stackFrame would be the same).
	var stackId = idgen();
	this.stack.stackMap[stackId] = stackFrame;
	this.stack.push(stackId);
	return stackId;
};

/**
 * Pops frame(s) from the call stack, keep popping until reaches stackId
 * @param {String} stackId - The stack frame id to pop
 * @private
 */
Tracer.prototype.popFrame = function(stackId) {
	// Pop from the stack until reaching stackId.
	// On normal execution we expect that the current top of the stack would be the stackId, but if unhandled
	// exception occurred it is possible that we skip frames, so we have to pop those skipped frames.
	var currStackId = this.stack.pop();
	while (currStackId && currStackId !== stackId) {
		currStackId = this.stack.pop();
	}

	// If this was the last frame in the stack delete the stackMap (so it won't get too large)
	// But first save the return value
	var res = this.stack.stackMap[currStackId];
	if (this.stack.length < 1) {
		this.stack.stackMap = {};
	}

	return res;
};

module.exports = Tracer;

/**
 * A call stack object
 * @typedef {Array} Tracer.CallStack
 * @property {object} stackMap - A dictionary where the key is the stack id and value is string in the format fnName@fnFile:line
 */

/**
 * The arguments that are passed to formatters when entering a traced function
 * @typedef {object} Tracer.functionEntryArgs
 * @property {string} name - The traced function name
 * @property {string} file - The traced file
 * @property {number} line - The traced function line number
 * @property {object} args - The function arguments object
 * @property {Tracer.CallStack} stack - The current call stack (including the current traced function)
 */

/**
 * The arguments that are passed to formatters when exiting a traced function
 * @typedef {object} Tracer.functionExitArgs
 * @property {string} name - The traced function name
 * @property {string} file - The traced file
 * @property {number} line - The traced function line number
 * @property {number} retLine - The line number where the exit is
 * @property {Tracer.CallStack} stack - The current call stack (AFTER the current traced function was removed)
 * @property {number} span - The execution time span (milliseconds) of the traced function
 * @property {boolean} exception - Whether this exit is due exception
 * @property {*|null} returnValue - The function return value
 */
