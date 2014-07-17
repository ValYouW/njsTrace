# njsTrace - Instrumentation and Tracing

**(alpha)**

njsTrace lets you easily instrument and trace you code, see all function calls, arguments, return values, as well as the time spent in each function.

## Installation
`npm isntall njsTrace`

## Example
To start tracing with the default settings just require njsTrace and call its inject method.
```javascript
var njsTrace = require('njsTrace').inject();

```
Lets take a look at the following 2 files dummy "app":


**main.js**
```javascript
// *** main.js ***
var njsTrace = require('njsTrace').inject(),
    mymod = require('./mymod.js');

// Use only 4 digits so the output would be easier to read
mymod.run(parseFloat(Math.random().toFixed(4)));
```
** mymod.js **
```javascript
// *** mymod.js ***
exports.run = function(number) {
    number = first(number);
    printResult(number);
}

function first(i) {
    i *= 100;
    return second(i, 'sqrt');
}

function second(k, method) {
    return {input: k, output: parseFloat(Math.sqrt(k).toFixed(4)), method: method};
}

function printResult(res) {
    require('fs').writeFileSync('output.txt', JSON.stringify(res));
}
```

The njsTrace output of this silly app would be like that
```
--> [Anonymous]@c:\temp\tracedemo\mymod.js::1, args:
<-- [Anonymous]@c:\temp\tracedemo\mymod.js::1, ts: 0, retLine: 22, retVal:
--> MyMod.run@c:\temp\tracedemo\mymod.js::17, args: {0}: 0.9967
  --> first@c:\temp\tracedemo\mymod.js::4, args: {0}: 0.9967
    --> second@c:\temp\tracedemo\mymod.js::9, args: {0}: 99.67 {1}: 'sqrt'
    <-- second@c:\temp\tracedemo\mymod.js::9, ts: 0, retLine: 10, retVal: { input: 99.67, output: 9.9835, method: 'sqrt' }
  <-- first@c:\temp\tracedemo\mymod.js::4, ts: 1, retLine: 6, retVal: { input: 99.67, output: 9.9835, method: 'sqrt' }
  --> printResult@c:\temp\tracedemo\mymod.js::13, args: {0}: { input: 99.67, output: 9.9835, method: 'sqrt' }
  <-- printResult@c:\temp\tracedemo\mymod.js::13, ts: 2, retLine: 15, retVal:
<-- MyMod.run@c:\temp\tracedemo\mymod.js::17, ts: 4, retLine: 20, retVal:
```

## How it works?
Once `njsTrace.inject()` is called njsTrace "hijacks" node.js `Module._compile()` method, this method is called whenever a module is being "required", njsTrace instrument the required module code, and then calls to the original `Module._compile()` with the instrumented code. The instrumentation just adds calls to njsTrace tracing methods at the beginning of each function, at the end of each function, and before any `return` statement.

All these calls to njsTrace tracing methods should be totally neutral and should not affect your code logic, it will however (obviously), affect the runtime performance of your code, hence it is recommended to run with tracing ONLY when debugging (there is a possibility to run with njsTrace disabled and enable it when necessary, see configuration explanation below).

## NJSTrace object
The NJSTrace object is the result of `require('njsTrace')` it exposes the following:

### inject(conifg)
The inject method can get a configuration object with the following:
* `enabled {boolean}` - Whether tracing is active, `default: true` **Note:** njsTrace will instrument the code regardless of this setting, and njsTrace tracing methods would be called, they will just do nothing, so the affect on runtime peeformace should be minimal. You can enable njsTrace during runtime by setting `njsTrace.enabled = true`
 
* `files {string|string[]}` - A glob file pattern(s) that matches the files to instrument,
this can be any pattern that is supported by `minimatch` npm module.
The matching is case-insensitive. Patterns are processed in-order with an 'or' operator, unless it's a
negative pattern (i.e starts with "!") which negates (if matches) all matches up to it.
All file paths are processed **relative** to the process working directory.
`default: All .js files EXCLUDING node_modules ['**/*.js', '!**/node_modules/**']`

* `wrapFunctions {boolean}` - Whether njsTrace should wrap the instrumented functions in a try/catch block. Wrapping the functions in try/catch can give better tracing in case of uncaought exceptions. `default: true` **NOTE:** wrapping functions in try/catch prevent v8 optimizations on the function, don't use it when profiling.

* `logger {boolean|string|function}` - Controls where the logger output should go. `default: false` njsTrace uses the logger to log about the instrumentation process and other information messages, the logger is NOT used for writing the tracing info (for this see `formatter` below). 
    * If Boolean, indicates whether NJSTrace will log (to the console) its progress.
    * If string, a path to an output file (absolute or relative to current working directory).
    * If function, a custom log function, gets a single {string} argument.


* `inspectArgs {boolean}` - Whether njsTrace should inspect the traced functions arguments and return values. `default: true` **NOTE:** Inspecting the arguments is done by passing the function's `arguments` object to a tracer method, passing the arguments object to another method prevent v8 optimizations on the function, don't use it when profiling.

* `formatter {Formatter|object | (Formatter|object)[]}` - An instance of formatter(s) to use for output or a config object(s) for the default formatter (read more on Formatters below)
    * if Formatter object, it will be added to the list of formatters to use
    * if object, a configuration to the default Formatter (see its options in the Formatters section below).
    * if Array, a list of formatters to use, or a list of configurations for the default formatter (can be mixed).

### enabled {boolean}
Gets or sets whether njsTrace is enabled or not. This let you start your application with instrumented code, but delay start the actual tracing (say start the tracing only after a specific event etc).
```javascript
// Start njsTrace disabled
var njsTrace = require('njsTrace').inject({enabled: false});
// And somewhere later in the code
njsTrace.enabled = true;

```
