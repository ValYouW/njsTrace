var Output = require('./output.js');

/**
 * Handling all the tracing and profiling collection
 * @param {NJSTrace~NJSConfig#trace} traceConfig The trace output object
 * @param {NJSTrace~NJSConfig#prof} profConfig The profiler output object
 * @constructor
 */
function Tracer(traceConfig, profConfig) {
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
			this.profOut = new Output(value);
		}
	},
});

/**
 * A callback handler for {@link NJSTrace~onFunctionEntry}
 */
Tracer.prototype.onEntry = function(args) {
	this.traceOut.write('Enter %s at %s::%s', args.name, args.file, args.line);
	return {name: args.name, file: args.file, line: args.line};
};

/**
 * A callback handler for {@link NJSTrace~onFunctionExit}
 */
Tracer.prototype.onExit = function(args) {
	this.traceOut.write('Exit %s at %s::%s', args.entryData.name, args.entryData.file, args.entryData.line);
};

module.exports = Tracer;
