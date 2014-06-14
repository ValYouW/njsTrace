var util = require('util'),
	path = require('path'),
	extend = require('extend'),
	fnmatch = require('./lib/fnmatch.js'),
	Module = require('module'),
	EventEmitter = require('events').EventEmitter,
	Injector = require('./lib/injector.js'),
	Output = require('./lib/output.js'),
	Tracer = require('./lib/tracer.js');

var DEFAULT_CONFIG = {
	enabled: true,
	files: ['**/*.js', '!**/node_modules/**'],
	wrapFunctions: true,
	logger: false,
	trace: true,
	prof: false,
	tabChar: '  ',
	onTraceEntry: null,
	onTraceExit: null,
	onCatchClause: null
};

 /**
 * Creates a new instance of NJSTrace
 * @param {NJSTrace.NJSConfig} [config] - A configuration object
 * @class The main class that is responsible for the entire njsTrace functionality
 * @extends EventEmitter
 * @constructor
 */
function NJSTrace(config) {
	EventEmitter.call(this);

	// Merge the config with the default config
	this.config = {};
	extend(true, this.config, DEFAULT_CONFIG, config);
	this.config.files = config.files || this.config.files; // In arrays we want to replace, not extend

	// Set the logger
	this.logger = new Output(this.config.logger);

	this.log('New instance of NJSTrace created with config:', this.config);

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

	// Warn about the use of wrapFunctions when profiling
	if (this.config.prof && this.config.wrapFunctions) {
		this.log('WARN: Profiler is enabled, it is recommended to set wrapFunctions=false in the configuration');
	}

	// Set the tracer, this is relevant only in case no custom trace handler provided
	this.tracer = this.config.onTraceEntry ? null : new Tracer(this.config.trace, this.config.prof, this.config.tabChar);
	if (this.tracer && this.config.onCatchClause) {
		this.log('WARN: onCatchClause was provided but will be ignored as no onTraceEntry/onTraceExit were provided');
		this.config.onCatchClause = null;
	}

	this.hijackCompile();
	this.setGlobalFunction();

	this.log('njsTrace done loading...');
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

// Define some properties with get/set on the prototype
Object.defineProperties(NJSTrace.prototype, {
	/**
	 * See "enabled" property on {@link NJSTrace.NJSConfig}
	 * @memberOf! NJSTrace.prototype
	 */
	'enabled': {
		get: function() {return this.config.enabled;},
		set: function(value) {
			this.config.prof = !!value;
			this.log('NJSTrace enabled property changed to: ', this.config.enabled);
		}
	}
});

/**
 * Simple logger function
 * @param {...string|number|object} arguments
 * @private
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
 * @private
 */
NJSTrace.prototype.hijackCompile = function() {
	this.log('Creating new Injector and hijacking Module.prototype._compile');
	var self = this;
	var injector = new Injector(this);

	// Save a reference to the _compile function and hijack it.
	var origCompile = Module.prototype._compile;
	Module.prototype._compile = function(content, filename) {
		// Check if we should instrument this file
		var relPath = path.relative(process.cwd(), filename);
		var instrument = fnmatch(relPath, self.config.files);

		if (instrument) {
			self.log('Instrumenting:', filename);

			// The content of a node Module needs to get wrapped in a function, otherwise it might be invalid (esprima won't like it otherwise).
			// We wrap it like node.js is wrapping (see Module.prototype._compile), since this logic might change we
			// check that the wrapping is done using 2 parts, if not just skip the wrapping and hope esprima won't fail :)
			if (Module.wrapper.length === 2) {
				content = Module.wrapper[0] + content + Module.wrapper[1];
			} else {
				self.log('WARN !! It seems like the node.js version you are using has changed and might be incompatible with njsTrace');
			}

			try {
				content = injector.injectTracing(filename, content, self.config.wrapFunctions);

				// If we wrapped the content we need now to remove it as node.js original compile will do it...
				if (Module.wrapper.length === 2) {
					content = content.substring(Module.wrapper[0].length, content.length - Module.wrapper[1].length);
				}

				self.log('Done:', filename);
			} catch (ex) {
				self.log('ERROR: Error instrumenting file:', filename, ', Exception:', ex);
			}
		}

		// And continue with the original compile...
		origCompile.call(this, content, filename);
	};
};

/**
 * Sets njsTrace tracing functions on the global context
 * @private
 */
NJSTrace.prototype.setGlobalFunction = function() {
	var self = this;

	this.log('Setting global.__njsTraceEntry__ function');
	global.__njsTraceEntry__ = function(args) {
		if (!self.config.enabled) {
			return;
		}

		if (self.config.onTraceEntry) {
			return self.config.onTraceEntry(args);
		} else {
			return self.tracer.onEntry(args);
		}
	};

	this.log('Setting global.__njsTraceExit__ function');
	global.__njsTraceExit__ = function(args) {
		if (!self.config.enabled) {
			return;
		}

		if (self.config.onTraceExit) {
			self.config.onTraceExit(args);
		} else {
			self.tracer.onExit(args);
		}
	};

	this.log('Setting global.__njsOnCatchClause__ function');
	global.__njsOnCatchClause__ = function(args) {
		if (!self.config.enabled) {
			return;
		}

		if (self.config.onCatchClause) {
			self.config.onCatchClause(args);
		} else {
			self.tracer.onCatchClause(args);
		}
	};
};

var instance = null;

/**
 * Creates or gets a reference to an NJSTrace instance
 * @param {NJSTrace.NJSConfig} config
 * @returns {NJSTrace} An instance of NJSTrace
 */
module.exports.inject = function(config) {
	if (!instance) {
		instance = new NJSTrace(config);
	}
	return instance;
};

/**
 * This callback is called when there is a message to log
 * @callback NJSTrace.onLog
 * @property {string} message - The log message
 */

/**
 * The njsTrace config object
 * @typedef {object} NJSTrace.NJSConfig
 *
 * @property {boolean} [enabled=true] - Whether tracing is active. Note: njsTrace will instrument the code regardless of this setting.
 *
 * @property {string|string[]} [files=<see description>] - A glob file pattern(s) that matches the files to instrument,
 * this supports any pattern supported by "minimatch" npm module.
 * The matching is case-insensitive. Patterns are processed in-order with an 'or' operator, unless it's a
 * negative pattern (i.e starts with "!") which negates (if match) all matches up to it.
 * All file paths are processed RELATIVE to the process working directory.
 * DEFAULT = All .js files EXCLUDING everything under node_modules (['**\/*.js', '!**\/node_modules\/**'])
 *
 * @property {boolean} [wrapFunctions=true] - Whether njsTrace should wrap the injected functions with try/catch
 * NOTE: wrapping functions with try/catch prevents from v8 to optimize the function, don't use when profiling
 *
 * @property {boolean|string|NJSTrace.onLog} [logger=false] - Controls where the logger output should go
 * If Boolean, indicates whether NJSTrace will log (to the console) its progress.
 * If string, a path to an output file (absolute or relative to current working dir).
 * If function, this function will be used as logger
 *
 */

/**
 * @typedef {object} NJSTrace.functionEntryArgs
 * @property {string} name - The traced function name
 * @property {string} file - The traced file
 * @property {Number} line - The traced function line number
 * @property {Object} args - The function arguments object
 */

/**
 * @typedef {object} NJSTrace.functionExitArgs
 * @property {Object} entryData - An object that was returned from NJSTrace.onFunctionEntry
 * @property {String} exception - Whether the exit occurred due to exception (throw Statement).
 *                                if "TRUE" then it was an unhandled exception
 * @property {number} line - The line number where the exit is
 * @property {*|undefined} returnValue - The function return value
 */

/**
 * @typedef {object} NJSTrace.catchClauseArgs
 * @property {Object} entryData - An object that was returned from NJSTrace.onFunctionEntry
 */

