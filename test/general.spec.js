var njsTrace = require('../njsTrace.js');
njsTrace.inject(({logger:true, enabled:true}));

var file1 = require('./mocks/file1.js');
file1.foo();