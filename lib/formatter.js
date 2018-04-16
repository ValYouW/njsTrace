var Output = require('./output.js'),
	extend = require('extend'),
	util = require('util');

// "    --> foo@dummy.js::123, args:xxx"
var TRACE_ENTRY = '%s%s %s@%s::%s, args: %s';

// "    <-- foo@dummy.js@123, [EX], ts: xx, retLine: 129, retVal:xxx" // EX==exception, ts==time span
var TRACE_EXIT = '%s%s %s@%s::%s, ts: %s, retLine: %s, retVal: %s';
var TRACE_EXIT_EX = '%s%s %s@%s::%s, EX, ts: %s, retLine: %s, retVal: %s';

var TRACE_EXIT_PREFIX = '<--';
var TRACE_ENTRY_PREFIX = '-->';
var TRACE_EXIT_PREFIX_SINGLE = '<-->';

var DEFAULT_CONFIG = {
	stdout: true,
	indentationChar: '  ',
	inspectArgsCount: 5,
	inspectArgsMaxLen: 500,
	inspectOptions: null,
	singleLine: false
};

/**
 * Creates a new instance of Formatter
 * @param {Formatter.Config} [config] - A config object
 * @constructor
 */
function Formatter(config) {
	this.config = {};
	extend(true, this.config, DEFAULT_CONFIG, config);

	this.output = new Output(this.config.stdout);
	this.indentation = '';
}

Object.defineProperties(Formatter.prototype, {
	/**
	 * See "stdout" property on {@link Formatter.Config}
	 * @memberOf! Formatter.prototype
	 */
	stdout: {
		get: function() { return this.config.stdout; },
		set: function(value) {
			this.config.stdout = value;
			this.output = new Output(value);
		}
	}
});

/**
 * Called on functions entry
 * @param {Tracer.functionEntryArgs} args - arguments with tracing info
 */
Formatter.prototype.onEntry = function(args) {
	if (this.config.singleLine) {
		return;
	}

	// Adjust the indentation according to the stack
	this.adjustIndentation(args.stack.length - 1);

	// Loop thru the arguments and inspect them
	var argsInspect = '';
	for (var i = 0; args.args && i < args.args.length && i < this.config.inspectArgsCount; ++i) {
		var currArg = this.inspect(args.args[i]);
		if (this.config.inspectArgsMaxLen > 0 && currArg.length > this.config.inspectArgsMaxLen) {
			currArg = currArg.substring(0, this.config.inspectArgsMaxLen) + '---';
		}
		argsInspect += '{' + i + '}: ' + currArg + ' ';
	}

	this.output.write(TRACE_ENTRY, this.indentation, TRACE_ENTRY_PREFIX, args.name, args.file, args.line, argsInspect);
};

/**
 * Called on functions exit
 * @param {Tracer.functionExitArgs} args - arguments with tracing info
 */
Formatter.prototype.onExit = function(args) {
	// Adjust the indentation according to the stack
	this.adjustIndentation(args.stack.length);

	var format = args.exception ? TRACE_EXIT_EX : TRACE_EXIT;
	var prefix = this.config.singleLine ? TRACE_EXIT_PREFIX_SINGLE : TRACE_EXIT_PREFIX;

	var retVal = this.inspect(args.returnValue);
	if (this.config.inspectArgsMaxLen > 0 && retVal.length > this.config.inspectArgsMaxLen) {
		retVal = retVal.substring(0, this.config.inspectArgsMaxLen) + '---';
	}

	this.output.write(format, this.indentation, prefix, args.name, args.file, args.line, args.span, args.retLine, retVal);
};

/**
 * Adjust the indentation based on the number of indentations needed
 * @param {number} indentations - The number of indentations needed
 * @protected
 */
Formatter.prototype.adjustIndentation = function(indentations) {
	// although this function could be a one liner like: this.indentation = new Array(indentations).join(this.config.indentationChar)
	// it is much faster using this method

	// if we have more than we need trim indentation
	if (this.indentation.length > indentations * this.config.indentationChar.length) {
		this.indentation = this.indentation.substring(0, indentations * this.config.indentationChar.length);
		return;
	}

	// Keep adding to indentation as long as needed
	while (this.indentation.length < indentations * this.config.indentationChar.length) {
		this.indentation += this.config.indentationChar;
	}
};

/**
 * Inspect an argument
 * @param {*} arg - The argument to inspect
 * @protected
 */
Formatter.prototype.inspect = function(arg) {
	// util.inspect break the result to multiple lines if it is too long (see node function reduceToSingleString() in util.js)
	// so here we remove the \n to keep the result as a single line
	return (arg !== null && typeof arg !== 'undefined') ? util.inspect(arg, this.config.inspectOptions).replace(/,\n  /g, ', ') : '';
};

module.exports = Formatter;

/**
 * A Formatter config object
 * @typedef {object} Formatter.Config
 *
 * @property {boolean|string|function} [stdout=true] - Controls where the output should go.
 * If Boolean, indicates whether the formatter will write output (to the console) or not.
 * If String, a path to an output file (absolute or relative to current working dir).
 * If function, then this function will be used for output (gets a single string arg).
 *
 * @property {string} [indentationChar=<2 space chars>] - The character used for output indentation (e.g '\t', '   ', etc)
 * @property {number} [inspectArgsCount=5] - The number of arguments to inspect on functions entry
 * @property {number} [inspectArgsMaxLen=500] - The maximum number of characters to print for each argument
 * @property {object} [inspectOptions=null] - An options object that would be passed to Node.js util.inspect method
 *
 * @property {boolean} [singleLine=false] - !! DO NOT USE, BUGGY !! Whether the output should be a single line (on function exit) or a two line (entry/exit).
 *
*/

