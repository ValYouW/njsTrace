var utils = require('utils'),
	extend = require('extend'),
	Module = require('module'),
	EventEmitter = require('events').EventEmitter,
	Injector = require('./lib/injector.js');

var DEFAULT_CONFIG = {
	enabled: true,
	log: false
};

 /**
 * Creates a new instance of NJSTrace
 * @class The main class that is responsible for the entire njsTrace functionality
 * @extends EventEmitter
 * @param {object}  config - A configuration object
 * @param {boolean} config.enabled - Whether or not the NJSTrace should run
 * @param {boolean} config.log - Whether or not NJSTrace will log to the console its progress
 * @constructor
 */
function NJSTrace(config) {
	EventEmitter.call(this);

	// Merge the config with the default config
	this.config = {};
	extend(true, this.config, config, DEFAULT_CONFIG);

	// Stop here if not enabled.
	if (!this.config.enabled) {
		this.log('njsTrace is disabled, doing nothing...');
		return;
	}

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
	if (!this.config.log) {
		return;
	}

	args = Array.prototype.slice.call(arguments, 0);
	args.unshift('njsTrace:');
	console.log.apply(console, args);
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
	global.__jsTrace__ = function() {
		//console.log('TRACE:', arguments);
	};
};

var instance = null;

/**
 * Creates or gets a reference to an NJSTrace instance
 * @param {NJSConfig} config
 * @returns {NJSTrace} An instance of NJSTrace
 */
module.exports = function(config) {
	if (!instance) {
		instance = new NJSTrace(config);
	}
	return instance;
};