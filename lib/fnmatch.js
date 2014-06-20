var minimatch = require('minimatch');

/**
 * Checks if a filepath match the given patterns
 * @param {string} filepath - The file path to evaluate
 * @param {string|string[]} patterns - A pattern(s) to run against filepath
 * @returns {boolean} Whether there is a match or not
 */
module.exports = function match(filepath, patterns) {
	// Return empty set if either patterns or filepath was omitted.
	if (!patterns || !filepath) { return false; }

	// Normalize patterns and filepath to arrays.
	if (!Array.isArray(patterns)) { patterns = [patterns]; }

	// Return empty set if there are no patterns or filepath.
	if (patterns.length === 0 || filepath.length === 0) { return []; }

	// Return all matching filepath.
	return processPatterns(patterns, filepath);
};

function processPatterns(patterns, filepath) {
	var match = false;
	patterns.forEach(function(pattern) {
		// If the first character is ! mark this as exclusion
		var exclusion = pattern.indexOf('!') === 0;

		var res = minimatch(filepath, pattern, {flipNegate: true, nocase:true});

		// The match is a union, unless this is a negative pattern which negates all (till the current pattern).
		match = match || res;
		if (exclusion && res) { match = false; }
	});

	return match;
}