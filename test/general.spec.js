var njsTrace = require('../njsTrace.js');
njsTrace.inject({logger: false, enabled: true, wrapFunctions:true, prof:false, trace:true});

var file1 = require('./mocks/file1.js');
file1.foo();
