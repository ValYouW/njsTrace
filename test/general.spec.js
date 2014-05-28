var njsTrace = require('../njsTrace.js');
njsTrace.inject({logger: true, enabled: true, prof:false, trace:'./trace2.txt'});

process.on('uncaughtException', function(e) {
	console.log('Uncaught Exception:', e);
});

var file1 = require('./mocks/file1.js');
file1.foo();
