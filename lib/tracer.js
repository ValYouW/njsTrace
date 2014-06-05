var Output = require('./output.js'),
	idgen = require('idgen');

/**
 * Handling all the tracing and profiling collection
 * @param {NJSTrace~NJSConfig#trace} traceConfig The trace output object
 * @param {NJSTrace~NJSConfig#prof} profConfig The profiler output object
 * @param {String} tabChar - The tab character used for spacing the trace output
 * @constructor
 */
function Tracer(traceConfig, profConfig, tabChar) {
	this.stack = [];
	this.stackMap = {};
	this.tabChar = tabChar || '  ';
	this.spacing = '';
	this.profActive = !!profConfig;
	this.traceOut = new Output(traceConfig);
	this.profOut = new Output(profConfig);
}

Object.defineProperties(Tracer.prototype, {
	'trace': {
		get: function() { return this.traceOut_; },
		set: function(value) {
			this.traceOut = new Output(value);
		}
	},
	'prof': {
		get: function() { return this.profOut_; },
		set: function(value) {
			this.profActive = !!value;
			this.profOut = new Output(value);
		}
	}
});

/**
 * A callback handler for {@link NJSTrace~onFunctionEntry}
 * @param {NJSTrace~functionEntryArgs} args - The event args
 */
Tracer.prototype.onEntry = function(args) {
	var ts = this.profActive ? Date.now() : 0;
	var stackFrame = args.name + '@' + args.file + '::' + args.line;
	this.traceOut.write('%s--> %s, args:%s', this.spacing, stackFrame, JSON.stringify(args.args));
	return {name: args.name, file: args.file, line: args.line, ts: ts, stackId: this.pushFrame(stackFrame)};
};

/**
 * A callback handler for {@link NJSTrace~onFunctionExit}
 * @param {NJSTrace~functionExitArgs} args - The event args
 */
Tracer.prototype.onExit = function(args) {
	var ts = (this.profActive && args.entryData.ts) ? Date.now() - args.entryData.ts : 0;
	this.popFrame(args.entryData.stackId);
	this.traceOut.write('%s<-- %s@%s::%s, ex:%s, ret:%s', this.spacing, args.entryData.name, args.entryData.file,
														  args.line, args.exception, JSON.stringify(args.returnValue));
	this.profOut.write('<--> %s at %s::%s, ts:%s', args.entryData.name, args.entryData.file, args.line, ts);
};

/**
 * A callback handler for {@link NJSTrace~onCatchClause}
 * @param {NJSTrace~catchClauseArgs} args - The event args
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
	if (!stackFrame) {
		// This should not happen, make sure the user get the message
		console.error('njsTrace: Got an empty stackFrame, that is weird, please report...');
		return;
	}
	// Need a unique id for a stack (in case of recursive calls the stackFrame would be the same).
	var stackId = idgen();
	this.stackMap[stackId] = stackFrame;
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
	if (!stackId) {
		// This should not happen, make sure the user get the message
		console.error('njsTrace: Got an empty stackId, that is weird, please report...');
		return;
	}

	// Pop from the stack until reaching stackId.
	// On normal execution we expect that the current top of the stack would be the stackId, but if unhandled
	// exception occurred it is possible that we skip frames, so we have to pop those skipped frames.
	this.spacing = this.spacing.slice(this.tabChar.length);
	var currStackId = this.stack.pop();
	while (currStackId && currStackId !== stackId) {
		this.spacing = this.spacing.slice(this.tabChar.length);
		currStackId = this.stack.pop();
	}

	// If this was the last frame in the stack delete the stackMap (so it won't get too large).
	if (this.stack.length < 1) {
		this.stackMap = {};
	}
};

module.exports = Tracer;
