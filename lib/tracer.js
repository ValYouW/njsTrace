var	util = require('util'),
	idgen = require('idgen');

/**
 * Handling all the tracing and profiling collection
 * @param {Formatter|Formatter[]} formatters - A list of formatters to use as output
 * @constructor
 */
function Tracer(formatters) {
	/**
	 * A call stack object
	 * @typedef {Array} NJSTrace.Tracer.CallStack
	 * @property {object} stackMap - A dictionary where the key is the stack id and value is string in the format fnName@fnFile:line
	 */
	this.stack = [];

	this.stack.stackMap = {};
	this.formatters = formatters || [];
	if (!util.isArray(this.formatters)) {
		this.formatters = [this.formatters];
	}
}

/**
 * Called on functions entry
 * @param {NJSTrace.functionEntryArgs} args - The event args
 * @returns {Object} An object that will be passed as argument to the onExit function
 */
Tracer.prototype.onEntry = function(args) {
	var stackFrame = args.name + '@' + args.file + '::' + args.line;
	var sid = this.pushFrame(stackFrame);

	for (var i = 0; i < this.formatters.length; ++i) {
		this.formatters[i].onEntry(args, this.stack);
	}

	return {name: args.name, file: args.file, line: args.line, ts: Date.now(), stackId: sid};
};

/**
 * Called on functions exit
 * @param {NJSTrace.functionExitArgs} args - The event args
 */
Tracer.prototype.onExit = function(args) {
	var ts = Date.now() - args.entryData.ts;
	var frame = this.popFrame(args.entryData.stackId);
	for (var i = 0; i < this.formatters.length; ++i) {
		this.formatters[i].onExit(args, this.stack, ts);
	}
};

/**
 * Called when the code hits a "catch" clause (i.e in try-catch).
 * @param {NJSTrace.catchClauseArgs} args - The event args
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
		this.spacing = this.spacing.slice(this.tabChar.length);
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
	this.spacing += this.tabChar;
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
	this.spacing = this.spacing.slice(this.tabChar.length);
	var currStackId = this.stack.pop();
	while (currStackId && currStackId !== stackId) {
		this.spacing = this.spacing.slice(this.tabChar.length);
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
