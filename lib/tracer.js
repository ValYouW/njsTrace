var Output = require('./output.js');

/**
 * Handling all the tracing and profiling collection
 * @param {NJSTrace~NJSConfig#trace} traceConfig The trace output object
 * @param {NJSTrace~NJSConfig#prof} profConfig The profiler output object
 * @constructor
 */
function Tracer(traceConfig, profConfig) {
	this.stack = [];
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
	var stackId = args.name + '@' + args.file + '::' + args.line;
	this.traceOut.write('%s--> %s, args:%s', this.spacing, stackId, JSON.stringify(args.args));
	this.stack.push(stackId);
	this.spacing += '  ';
	return {name: args.name, file: args.file, line: args.line, ts: ts};
};

/**
 * A callback handler for {@link NJSTrace~onFunctionExit}
 * @param {NJSTrace~functionExitArgs} args - The event args
 */
Tracer.prototype.onExit = function(args) {
	var ts = (this.profActive && args.entryData.ts) ? Date.now() - args.entryData.ts : 0;
	this.spacing = this.spacing.slice('2');
	this.traceOut.write('%s<-- %s at %s::%s, ex:%s, ret:%s', this.spacing, args.entryData.name, args.entryData.file, args.line, args.exception, JSON.stringify(args.returnValue));
	this.profOut.write('<--> %s at %s::%s, ts:%s', args.entryData.name, args.entryData.file, args.line, ts);
	this.stack.pop();
};

module.exports = Tracer;
