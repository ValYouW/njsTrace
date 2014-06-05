var njsTrace = require('../njsTrace.js');
njsTrace.inject({logger: true, enabled: true, wrapFunctions:true, prof:false, trace:true, tabChar:'\t'});//, files:['**/*.js', '!**/node_modules/**', 'node_modules/colors/**/*.js']});

//var file1 = require('./mocks/file1.js');
var file2 = require('./mocks/file2.js');
//file1.foo();
file2.foo();
