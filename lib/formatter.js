var Output = require('./output.js'),
	extend = require('extend');

var TRACE_OUT = '%s %s, ts: %s, retLine: %s, retVal:%s';
var TRACE_OUT_EX = '%s %s, EXCEPTION, ts:%s, retLine: %s, retVal:%s';

var DEFAULT_CONFIG = {
	stdout: true,
	indentationChar: '  ',
	singleLine: false
};

/**
 * Creates a new instance of Formatter
 * @param {NJSTrace.Formatter.Config} [config] - A config object
 * @constructor
 */
function Formatter(config) {
	this.config = {};
	extend(true, this.config, DEFAULT_CONFIG, config);

	this.output = new Output(this.config.stdout);
	this.spacing = '';
}

Object.defineProperties(Formatter.prototype, {
	/**
	 * See "stdout" property on {@link NJSTrace.Formatter.Config}
	 * @memberOf! Formatter.prototype
	 */
	'stdout': {
		get: function() { return this.config.stdout; },
		set: function(value) {
			this.config.stdout = value;
			this.output = new Output(value);
		}
	}
});

/**
 * Called on functions entry
 * @param {NJSTrace.functionEntryArgs} args - Arguments with the called function info
 * @param {NJSTrace.Tracer.CallStack} stack - The current call stack
 */
Formatter.prototype.onEntry = function(args, stack) {
	if (this.config.singleLine) {
		return;
	}

	var spacingCount = (stack.length - 1) * this.config.indentationChar.length;




	var stackFrame = args.name + '@' + args.file + '::' + args.line;

	//this.traceOut.write('%s--> %s, args:%s', this.spacing, stackFrame, JSON.stringify(args.args));
	this.output.write('%s--> %s, args:%s', this.spacing, stackFrame);


};

/**
 * Called on functions exit
 * @param {NJSTrace.functionExitArgs} args - Arguments with the called function info
 * @param {NJSTrace.Tracer.CallStack} stack - The current call stack
 * @param {number} span - The execution time span (milliseconds) of the traced function
 */
Formatter.prototype.onExit = function(args, stack, span) {
	var spacingCount = (stack.length - 1) * this.config.indentationChar.length;
	var stackFrame = args.name + '@' + args.file + '::' + args.line;
	var format = args.exception ? TRACE_OUT_EX : TRACE_OUT;
	//this.traceOut.write(format, this.spacing, frame, args.line, JSON.stringify(args.returnValue));
	this.traceOut.write(format, this.spacing, frame, args.line);

	//this.profOut.write('<--> %s, ts:%s', frame, ts);


};

/**
 * Adjust the spacing based on the number of indentations needed
 * @param {number} indentations - The number of indentations needed
 */
Formatter.prototype.adjustSpacing = function(indentations) {
	// although this function could be a one liner like: this.spacing = new Array(indentations).join(this.config.indentationChar)
	// it is much faster using this method

	// if we have more than we need trim spacing
	if (this.spacing.length > indentations * this.config.indentationChar.length) {
		this.spacing = this.spacing.substring(0, indentations * this.config.indentationChar.length);
		return;
	}

	// Keep adding to spacing as long as needed
	while (this.spacing.length < indentations * this.config.indentationChar.length) {
		this.spacing += this.config.indentationChar;
	}
};

module.exports = Formatter;

/**
 * A Formatter config object
 * @typedef {object} NJSTrace.Formatter.Config
 *
 * @property {boolean|string|function} [stdout=true] - Controls where the output should go.
 * If Boolean, indicates whether the formatter will write output (to the console) or not.
 * If String, a path to an output file (absolute or relative to current working dir).
 * If function, then this function will be used for output (gets a single string arg).
 *
 * @property {string} [indentationChar=<2 space chars>] - The character used for output indentation (e.g '\t', '   ', etc)
 *
 * @property {boolean} [singleLine=false] - Whether the output should be a single line (on function exit) or a two line (entry/exit).
 *
*/

