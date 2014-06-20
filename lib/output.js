var fs = require('fs'),
	util = require('util'),
	path = require('path');

/**
 * A class for writing data to some output
 * @name NJSTrace~Output
 * @param {boolean|string|function} config If boolean then will output to console
 *                                         If string then it will be used as a path to an output file
 *                                         If function then this function will be used for output
 * @constructor
 */
function Output(config) {
	if (typeof config === 'undefined') {
		throw new Error('Output config is mandatory');
	}

	this.stdout = null;
	this.stdoutFn = null;

	// If config is a boolean then output is process.stdout
	if (typeof config === 'boolean') {
		this.stdout = config ? process.stdout : null;
		this.stdoutFn = config ? process.stdout.write : null;
	// If config is string then output is a file
	} else if (typeof config === 'string') {
		// Get the full path of the output file and make sure the directory it is in exists
		var file = path.resolve(process.cwd(), config);
		var outputDir = path.dirname(file);
		if (!fs.existsSync(outputDir)) {
			throw new Error('Invalid output file, directory does not exist:' + outputDir);
		}
		var stream = fs.createWriteStream(file);
		this.stdout = stream;
		this.stdoutFn = stream.write;
	// config can be a "log" function, so use it.
	} else if (typeof config === 'function') {
		this.stdout = this;
		this.stdoutFn = config;
	// Unknown config, error
	} else {
		throw new Error('Output got invalid config:', config);
	}
}

/**
 * Writes data to the output resource
 * @param {...string|number|object} arguments - data to be written, can be a formatted string
 */
Output.prototype.write = function() {
	if (this.stdout === null) {
		return;
	}

	// format the arguments and add \n
	var msg = util.format.apply(this, arguments) + '\n';
	this.stdoutFn.call(this.stdout, msg);
};

/**
 * Writes data to the output resource with no formatting nor new line
 * @param {string} data - The data to write
 */
Output.prototype.print = function(data) {
	if (this.stdout === null) {
		return;
	}

	this.stdoutFn.call(this.stdout, data);
};

module.exports = Output;