# njsTrace - Instrumentation and Tracing

**Still in alpha**

njsTrace lets you easily instrument and trace you code, see all the function calls, arguments and return values,
as well as the time spent in each function.

## Installation
`npm isntall njsTrace`

## Usage
To start tracing with the default settings just require njsTrace and call its inject method.
```javascript
var njsTrace = require('njsTrace');
njsTrace.inject();

```