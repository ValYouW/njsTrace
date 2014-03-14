var fs = require('fs'),
	util = require('util'),
	path = require('path');

function Output(config) {
	if (!config) {
		throw new Error('Output config is mandatory');
	}

	this.outputFunc = null;

	// If config is a boolean then output is process.stdout
	if (typeof config === 'boolean') {
		this.outputFunc = config ? process.stdout.write.bind(process.stdout) : null;
	// If config is string then output is a file
	} else if (typeof config === 'string') {
		// Get the full path of the output file and make sure the directory it is in exists
		var file = path.resolve(process.cwd(), config);
		var outputDir = path.dirname(file);
		if (!fs.existsSync(outputDir)) {
			throw new Error('Invalid output file, directory does not exist:' + outputDir);
		}
		var stream = fs.createWriteStream(file);
		this.outputFunc = stream.write.bind(stream);
	// If config is a function use it for output
	} else if (typeof config === 'function') {
		this.outputFunc = config;
	// Unknown config, error
	} else {
		throw new Error('Output got invalid config');
	}
}

/**
 * Writes data to the output resource
 * @param {...string|number|object} args - data to be written, can be a formatted string
 */
Output.prototype.write = function(args) {
	if (this.output === null) {
		return;
	}

	// format the arguments
	args = Array.prototype.slice.call(arguments, 0);
	var str = util.format.apply(util, args);

	// Call the output func
	//process.stdout.write(str);
	this.outputFunc(str);
};

module.exports = Output;