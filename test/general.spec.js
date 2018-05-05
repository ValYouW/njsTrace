// --- TODO: Write some real tests ---

var njsTrace = require('../njsTrace.js');
njsTrace.inject({
	inspectArgs: true,
	logger: false,
	enabled: true,
	wrapFunctions: true,
	files: ['**/*.js', '!**/node_modules/**'],
	formatter: {inspectArgsCount: 3, inspectArgsMaxLen: 50, inspectOptions: {colors: false}}
});

// var file1 = require('./mocks/file1.js');
// file1.foo();
// var file2 = require('./mocks/file2.js');
// file2.foo();
// require('./mocks/async.js');
// require('./mocks/generators.js');
require('./mocks/basic.js');
