// --- TODO: Write some real tests ---

var njsTrace = require('../njsTrace.js');
njsTrace.inject({inspectArgs: true,
				 logger: false,
				 enabled: true,
				 wrapFunctions:true,
				 files:['**/*.js', '!**/node_modules/**', 'node_modules/colors/**/*.js'],
				 formatter: {inspectArgsCount:3, inspectArgsMaxLen:20, inspectOptions:{colors:true}}
				});

//var file1 = require('./mocks/file1.js');
var file2 = require('./mocks/file2.js');
//file1.foo();
file2.foo();
