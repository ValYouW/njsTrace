var os = require('os'),
	utils = require('util'),
	extend = require('extend'),
	Module = require('module'),
	EventEmitter = require('events').EventEmitter,
	Injector = require('./lib/injector.js'),
	Output = require('./lib/output.js');

var DEFAULT_CONFIG = {
	enabled: true,
	logger: false,
	output: '',
	trace: false,
	performance: true
};

/**
 * This callback is called when there is a message to log
 * @callback NJSTrace~onLog
 * @param {string} message - The log message
 */

/**
 * A callback that handles a trace on functions entry
 * @callback NJSTrace~onTraceEntry
 * @param {string} file - The traced file
 * @param {string} name - The traced function name
 * @param {Number} line - The traced function line number
 * @param {Object} args - The function arguments object
 * @returns {Object} An object that will be passed as argument to NJSTrace~onTraceExit
 */

/**
 * A callback that handles a trace on functions exit
 * @callback NJSTrace~onTraceExit
 * @param {string} file - The traced file
 * @param {string} name - The traced function name
 * @param {Number} line - The traced function line number
 * @param {Object} entryData - An object that was returned from NJSTrace~onTraceEntry
 */

/**
 * @typedef NJSTrace~NJSConfig
 * @property {boolean} [enabled=true] - Whether or not instrumentation is enabled
 * @property {boolean|string|function} [logger=false] - If Boolean, indicates whether NJSTrace will log (to the console) its progress.
 *                                                      If string, a path to an output file (absolute or relative to current working dir).
 *                                                      If function, this function will be used as logger
 * @property {boolean|string} [trace=false] - If Boolean, indicates whether NJSTrace will output (to the console) trace info.
 *                                            If string, a path to a trace output file (absolute or relative to current working dir).
 * @property {boolean|string} [prof=true]   - If Boolean, indicates whether NJSTrace will output (to the console) profiler info.
 *                                            If string, a path to a profiler output file (absolute or relative to current working dir).
 * @property {NJSTrace~onTraceEntry} [traceEntryHandler=null] - A custom trace handler that will be called on functions entry.
 *                                                              If provided then the trace and prof settings above are ignored.
 *                                                              If provided traceExitHandler must be provided as well.
 * @property {NJSTrace~onTraceExit}  [traceExitHandler=null]  - A custom trace handler that will be called on functions exit.
 *                                                              If provided then the trace and prof settings above are ignored.
 *                                                              If provided traceEntryHandler must be provided as well.
 */

 /**
 * Creates a new instance of NJSTrace
 * @class The main class that is responsible for the entire njsTrace functionality
 * @extends EventEmitter
 * @param {NJSTrace~NJSConfig} config - A configuration object
 * @constructor
 */
function NJSTrace(config) {
	EventEmitter.call(this);

	// Merge the config with the default config
	this.config = {};
	extend(true, this.config, DEFAULT_CONFIG, config);

	this.log('New instance of NJSTrace created with config:', this.config);

	// Stop here if not enabled.
	if (!this.config.enabled) {
		this.log('njsTrace is disabled, doing nothing...');
		return;
	}

	// Validate trace functions (if provided).
	if ((this.config.onTraceEntry !== null && this.config.onTraceExit === null) ||
		(this.config.onTraceEntry === null && this.config.onTraceExit !== null)) {
		throw new Error('onTraceEntry and onTraceExit must be both provided or both be null');
	}

	// Set the logger
	this.logger = new Output(this.config.logger);

	// Set the trace/prof outputs, this is relevant only in case no custom trace handler provided
	this.traceOutput = this.config.onTraceEntry === null ? new Output(this.config.trace) : null;
	this.profOutput = this.config.onTraceEntry === null ? new Output(this.config.prof) : null;

	this.hijackCompile();
	this.setGlobalFunction();
}
utils.inherits(NJSTrace, EventEmitter);

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
 * @param {...string|number|object} args
 */
NJSTrace.prototype.log = function(args) {
	if (!this.logger) {
		return;
	}

	args = Array.prototype.slice.call(arguments, 0);
	args.push(os.EOL);

	// Don't want to insert our prefix into args (can effect format strings), so use print which doesn't put newline.
	this.logger.write('njsTrace: ');
	this.logger.write.apply(this.logger, args);
};

/**
 * Handles a trace on functions entry
 * @param {Object} fnData Data about the function be traced, see {@link NJSTrace~onTraceEntry}
 */
NJSTrace.prototype.traceEntry = function(fnData) {
	if (this.config.onTraceEntry) {
		return this.config.onTraceEntry(fnData.file, fnData.name, fnData.line, fnData.args);
	}
};

/**
 * Handles a trace on functions exit
 * @param {Object} fnData Data about the function be traced, see {@link NJSTrace~onTraceExit}
 */
NJSTrace.prototype.traceExit = function(fnData) {
	if (this.config.onTraceExit) {
		return this.config.onTraceEntry(fnData.file, fnData.name, fnData.line, fnData.entryData);
	}
};

/**
 * Hijack Node.js Module._compile method and inject the tracing stuff...
 */
NJSTrace.prototype.hijackCompile = function() {
	var self = this;
	var injector = new Injector(this);

	// Save a reference to the _compile function and hijack it.
	var origCompile = Module.prototype._compile;
	Module.prototype._compile = function(content, filename) {
		self.log('Instrumenting:', filename);
		content = injector.injectTracing(filename, content);

		// And continue with the original compile...
		origCompile.call(this, content, filename);
	};
};

/**
 * Sets njsTrace tracing functions on the global context
 */
NJSTrace.prototype.setGlobalFunction = function() {
	var self = this;
	global.__njsTraceStart__ = function(funcData) {
		//self.output('In %s %s::%s', funcData.name, funcData.file, funcData.line);
		//self.output('\t arguments:', funcData.args);
		return {time: Date.now()};
	};
};

var instance = null;

/**
 * Creates or gets a reference to an NJSTrace instance
 * @param {NJSConfig} config
 * @returns {NJSTrace} An instance of NJSTrace
 */
module.exports.inject = function(config) {
	if (!instance) {
		instance = new NJSTrace(config);
	}
	return instance;
};