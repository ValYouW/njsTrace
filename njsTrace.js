var util = require('util'),
	extend = require('extend'),
	Module = require('module'),
	EventEmitter = require('events').EventEmitter,
	Injector = require('./lib/injector.js'),
	Output = require('./lib/output.js'),
	tracer = require('./lib/tracer.js');

var DEFAULT_CONFIG = {
	enabled: true,
	logger: false,
	output: '',
	trace: true,
	prof: false,
	onTraceEntry: null,
	onTraceExit: null
};

/**
 * This callback is called when there is a message to log
 * @callback NJSTrace~onLog
 * @property {string} message - The log message
 */

/**
 * The callback type that is raised on traced functions entry
 * @callback NJSTrace~onFunctionEntry
 * @property {NJSTrace~functionEntryArgs} args - Object with info about the traced function
 * @returns {Object} An object that will be passed as argument to NJSTrace~onFunctionExit
 */

/**
 * The callback type that is raised on traced functions exit
 * @callback NJSTrace~onFunctionExit
 * @property {NJSTrace~functionExitArgs} args - Object with info about the traced function
 */

/**
 * @name NJSTrace~functionEntryArgs
 * @property {string} name - The traced function name
 * @property {string} file - The traced file
 * @property {Number} line - The traced function line number
 * @property {Object} args - The function arguments object
 */

/**
 * @name NJSTrace~functionExitArgs
 * @property {string} name - The traced function name
 * @property {string} file - The traced file
 * @property {Number} line - The traced function line number
 * @property {Object} entryData - An object that was returned from NJSTrace~onFunctionEntry
 */

/**
 * @name NJSTrace~NJSConfig
 * @property {boolean} [enabled=true] - Whether or not instrumentation is enabled
 * @property {boolean|string|NJSTrace~onLog} [logger=false] - If Boolean, indicates whether NJSTrace will log (to the console) its progress.
 *                                                            If string, a path to an output file (absolute or relative to current working dir).
 *                                                            If function, this function will be used as logger
 *
 * @property {boolean|string} [trace=false] - If Boolean, indicates whether NJSTrace will output (to the console) trace info.
 *                                            If string, a path to a trace output file (absolute or relative to current working dir).
 * @property {boolean|string} [prof=true]   - If Boolean, indicates whether NJSTrace will output (to the console) profiler info.
 *                                            If string, a path to a profiler output file (absolute or relative to current working dir).
 *
 * @property {NJSTrace~onFunctionEntry} [onTraceEntry=null] - A custom trace handler that will be called on functions entry.
 *                                                                    If provided, then the trace and prof settings above are ignored.
 *                                                                    If provided, functionExitHandler must be provided as well.
 * @property {NJSTrace~onFunctionExit}  [onTraceExit=null]  - A custom trace handler that will be called on functions exit.
 *                                                                    If provided, then the trace and prof settings above are ignored.
 *                                                                    If provided, functionEntryHandler must be provided as well.
 */

 /**
 * Creates a new instance of NJSTrace
 * @class The main class that is responsible for the entire njsTrace functionality
 * @extends EventEmitter
 * @param {NJSTrace~NJSConfig} [config] - A configuration object
 * @constructor
 */
function NJSTrace(config) {
	EventEmitter.call(this);

	// Merge the config with the default config
	this.config = {};
	extend(true, this.config, DEFAULT_CONFIG, config);

	// Set the logger
	this.logger = new Output(this.config.logger);

	this.log('New instance of NJSTrace created with config:', this.config);

	// Stop here if not enabled.
	if (!this.config.enabled) {
		this.log('njsTrace is disabled, doing nothing...');
		return;
	}

	// Validate trace functions (if provided).
    if (this.config.onTraceEntry && typeof this.config.onTraceEntry !== 'function') {
        throw new Error('onTraceEntry in config object must be a function');
    } else if (this.config.onTraceExit && typeof this.config.onTraceExit !== 'function') {
        throw new Error('onTraceExit in config object must be a function');
    }

	// Make sure that both traceEntry/Exit are provided (or both not provided).
    this.config.onTraceEntry = this.config.onTraceEntry || null;
    this.config.onTraceExit = this.config.onTraceExit || null;
    if (typeof this.config.onTraceEntry !== typeof this.config.onTraceExit) {
		throw new Error('onTraceEntry and onTraceExit must be both provided or both be null');
	}

	// Set the trace entry/exit functions
	this.traceEntryHandler = this.config.onTraceEntry || tracer.onEntry;
	this.traceExitHandler = this.config.onTraceExit || tracer.onExit;

	// Set the trace/prof outputs, this is relevant only in case no custom trace handler provided
	this.traceOutput = this.config.onTraceEntry ? null : new Output(this.config.trace);
	this.profOutput = this.config.onTraceEntry ? null : new Output(this.config.prof);

	this.hijackCompile();
	this.setGlobalFunction();

	require.cache[require.resolve('extend')] = null;
	require.cache[require.resolve('util')] = null;
	require.cache[require.resolve('module')] = null;
	require.cache[require.resolve('events')] = null;
}
util.inherits(NJSTrace, EventEmitter);

/**
 * NJSTrace exposed event names
 * @type {object}
 * @property {string} Error - An error event
 * @property {string} Warn - A warning event
 * @example
 * njsTrace.on(NJSTrace.events.error, function() {...});
 */
NJSTrace.events = {
	error: 'error',
	warn: 'warn'
};

/**
 * Simple logger function
 * @param {...string|number|object} arguments
 */
NJSTrace.prototype.log = function() {
	if (!this.logger) {
		return;
	}

	// Don't want to insert our prefix into args (can effect format strings), so use print which doesn't put newline.
	this.logger.print('njsTrace: ');
	this.logger.write.apply(this.logger, arguments);
};

/**
 * Hijack Node.js Module._compile method and inject the tracing stuff...
 */
NJSTrace.prototype.hijackCompile = function() {
	this.log('Creating new Injector and hijacking Module.prototype._compile');
	var self = this;
	var injector = new Injector(this, {entryHandler: '__njsTraceEntry__', exitHandler: '__njsTraceExit__'});

	// Save a reference to the _compile function and hijack it.
	var origCompile = Module.prototype._compile;
	Module.prototype._compile = function(content, filename) {
		self.log('Instrumenting:', filename);
		content = injector.injectTracing(filename, content);
		self.log('Done:', filename);

		// And continue with the original compile...
		origCompile.call(this, content, filename);
	};
};

/**
 * Sets njsTrace tracing functions on the global context
 */
NJSTrace.prototype.setGlobalFunction = function() {
	var self = this;

	this.log('Setting global.__njsTraceEntry__ function');
	global.__njsTraceEntry__ = function() {
		if (self.config.trace || self.config.prof) {
			return self.traceEntryHandler.apply(self, arguments);
		}
	};

	this.log('Setting global.__njsTraceExit__ function');
	global.__njsTraceExit__ = function() {
		if (self.config.trace || self.config.prof) {
			return self.traceExitHandler.apply(self, arguments);
		}
	};
};

var instance = null;

/**
 * Creates or gets a reference to an NJSTrace instance
 * @param {NJSTrace~NJSConfig} config
 * @returns {NJSTrace} An instance of NJSTrace
 */
module.exports.inject = function(config) {
	if (!instance) {
		instance = new NJSTrace(config);
	}
	return instance;
};