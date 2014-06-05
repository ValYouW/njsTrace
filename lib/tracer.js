var Output = require('./output.js'),
	idgen = require('idgen');

/**
 * Handling all the tracing and profiling collection
 * @param {NJSTrace~NJSConfig#trace} traceConfig The trace output object
 * @param {NJSTrace~NJSConfig#prof} profConfig The profiler output object
 * @constructor
 */
function Tracer(traceConfig, profConfig) {
	this.stack = [];
	this.stackMap = {};
	this.tabStr = '  ';
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
	this.traceOut.write('%s<-- %s@%s::%s, ex:%s, ret:%s', this.spacing, args.entryData.name, args.entryData.file, args.line, args.exception, JSON.stringify(args.returnValue));
	this.profOut.write('<--> %s at %s::%s, ts:%s', args.entryData.name, args.entryData.file, args.line, ts);
};

/**
 * Push a frame into the call stack
 * @param {String} stackFrame - The frame id to push
 * @returns {String} The assigned stack id
 * @private
 */
Tracer.prototype.pushFrame = function(stackFrame) {
	if (!stackFrame) {
		throw new Error('njsTrace: Got an empty stackFrame, that is weird...');
	}
	// Need a unique id for a stack (in case of recursive calls the stackFrame would be the same).
	var stackId = idgen();
	this.stackMap[stackId] = stackFrame;
	this.stack.push(stackId);
	this.spacing += this.tabStr;
	return stackId;
};

/**
 * Pops frame(s) from the call stack, keep popping until reaches stackId
 * @param {String} stackId - The stack frame id to pop
 * @private
 */
Tracer.prototype.popFrame = function(stackId) {
	if (!stackId) {
		return;
	}

	// Pop from the stack until reaching stackId.
	// On normal execution we expect that the current top of the stack would be the stackId, but if unhandled
	// exception occurred it is possible that we skip frames, so we have to pop those skipped frames.
	this.spacing = this.spacing.slice(this.tabStr.length);
	var currStackId = this.stack.pop();
	while (currStackId && currStackId !== stackId) {
		this.spacing = this.spacing.slice(this.tabStr.length);
		currStackId = this.stack.pop();
	}

	// If this was the last frame in the stack delete the stackMap (so it won't get too large).
	if (this.stack.length < 1) {
		this.stackMap = {};
	}
};

module.exports = Tracer;
