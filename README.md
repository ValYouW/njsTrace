# njsTrace - Instrumentation and Tracing

njstrace lets you easily instrument and trace you code, see all function calls, arguments, return values, as well as the time spent in each function.

## Installation
`npm install njstrace`

## Example
To start tracing with the default settings just require njstrace and call its inject method.
```javascript
var njstrace = require('njstrace').inject();

```
Lets take a look at the following 2 files dummy "app":


**main.js**
```javascript
// *** main.js ***
var njstrace = require('njstrace').inject(),
    mymod = require('./mymod.js');

// Use only 4 digits so the output would be easier to read
mymod.run(parseFloat(Math.random().toFixed(4)));
```
**mymod.js**
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

The njstrace output of this silly app would be like that
```
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
Once `njstrace.inject()` is called njstrace "hijacks" node.js `Module._compile()` method, this method is called whenever a module is being "required", njstrace instrument the required module code, and then calls to the original `Module._compile()` with the instrumented code. The instrumentation just adds calls to njstrace tracing methods at the beginning of each function, at the end of each function, and before any `return` statement.

All these calls to njstrace tracing methods should be totally neutral and should not affect your code logic, it will however (obviously), affect the runtime performance of your code, hence it is recommended to run with tracing ONLY when debugging (there is a possibility to run with njstrace disabled and enable it when necessary, see configuration explanation below).

**NOTE:** Since the instrumentation happens when the `Module._compile()` is called, only modules that are "required" after the call to `njstrace.inject()` would get instrumented. Practically it means that the actual module that calls to `njstrace.inject()` will not be instrumented, so in the example above, there is no instrumentation on `main.js`

## NJSTrace object
The NJSTrace object is the result of `require('njstrace')` it exposes the following:

### inject(config)
The inject method can get a configuration object with the following:
* `enabled {boolean}` - Whether tracing is active, `default: true` **Note:** njstrace will instrument the code regardless of this setting, and njstrace tracing methods would be called, they will just do nothing, so the affect on runtime peeformace should be minimal. You can enable njstrace during runtime by setting `njstrace.enabled = true`

* `files {string|string[]}` - A glob file pattern(s) that matches the files to instrument,
this can be any pattern that is supported by `minimatch` npm module.
The matching is case-insensitive. Patterns are processed in-order with an 'or' operator, unless it's a
negative pattern (i.e starts with "!") which negates (if matches) all matches up to it.
`default: All .js files EXCLUDING node_modules ['**/*.js', '!**/node_modules/**']`
NOTE: All file paths are processed **relative** to the process working directory, which means that the glob patterns
also have to be relative to the working directory. If you are not running your app from the "root" of your app
(i.e running from a sub-direcotry "node ../server.js"), you will not be able to use the default glob patterns, a solution
could be to use something like that:
```javascript
var path = require('path');

// Get the relative path from the working directory to the directory of the main app file
var rel = path.relative(process.cwd(), __dirname);

// Build the glob pattern for all JS files one that excludes node_modules, and use those
var alljs = path.join(rel, '**', '*.js');
var noNodeMods = '!' + path.join(rel, '**', 'node_modules', '**');
var njstrace = require('njstrace').inject({files: [alljs, noNodeMods]}),
```

* `wrapFunctions {boolean}` - Whether njstrace should wrap the instrumented functions in a try/catch block. Wrapping the functions in try/catch can give better tracing in case of uncaought exceptions. `default: true` **NOTE:** wrapping functions in try/catch prevent v8 optimizations on the function, don't use it when profiling.

* `logger {boolean|string|function}` - Controls where the logger output should go. `default: false` njstrace uses the logger to log about the instrumentation process and other information messages, the logger is NOT used for writing the tracing info (for this see `formatter` below).
    * If Boolean, indicates whether NJSTrace will log (to the console) its progress.
    * If string, a path to an output file (absolute or relative to current working directory).
    * If function, a custom log function, gets a single {string} argument.


* `inspectArgs {boolean}` - Whether njstrace should inspect the traced functions arguments and return values. `default: true` **NOTE:** Inspecting the arguments is done by passing the function's `arguments` object to a tracer method, passing the arguments object to another method prevent v8 optimizations on the function, don't use it when profiling.

* `formatter {Formatter|object | (Formatter|object)[]}` - An instance of Formatter(s) to use for output or a config object(s) for the default formatter (read more on Formatters below)
    * if Formatter object, it will be added to the list of formatters to use
    * if object, a configuration to the default Formatter (see its options in the Formatters section below).
    * if Array, a list of formatters to use, or a list of configurations for the default formatter (can be mixed, so if two configuration objects are provided, two default formatters would be created with the given config).

### enabled {boolean}
Gets or sets whether njstrace is enabled or not. This let you start your application with instrumented code, but delay start the actual tracing (say start the tracing only after a specific event etc).
```javascript
// Start njstrace disabled (instrument the code but tracing is not active)
var njstrace = require('njstrace').inject({enabled: false});
// And somewhere later in the code activate the tracing
njstrace.enabled = true;
```

## Formatters
njstrace uses formatters to write the tracing output, it can use multiple formatters so in a single run several files in different formats would be written. The formatters that njstrace will use are configured using the `formatter` property on the configuration object passed to the `inject()` method.

### Default Formatter
While you can write your own Formatter object, njstrace comes with a default formatter which can be configured using an object with the following properties:
* `stdout {boolean|string|function}` - Controls where the output should go. `default: true`
    * If Boolean, indicates whether the formatter will write output (**to the console**) or not.
    * If String, a path to an output file (absolute or relative to current working dir).
    * If function, this function will be used for output (gets a single string arg).

* `indentationChar {string}` - The character used for output indentation of the call stack (e.g '\t', '   ', etc). `default: 2 space chars`

* `inspectArgsCount {number}` - The number of arguments to inspect on functions entry. `default: 5`

* `inspectArgsMaxLen {number}` - The maximum number of characters to print for each argument and return value (prevent endless prints on very long arguments). If `0` then unlimited. `default: 500`

* `inspectOptions {object}` - The inspection is done using Node.js `util.inspect` method, this is an options object for that function. `default: null`

**Example**
```javascript
// Create formatter options that will write to the console, limit each argument inspect output to 100 chars,
// color the arguments and use 4 spaces indentation
var consoleFormatter = {
    stdout: true, // this is actually the default and can be removed
    inspectArgsMaxLen: 100,
    indentationChar: '    ',
    inspectOptions: {colors: true}
};

// Create another formatter options that will write to a file, no limit on arguments length, and use "\t" as indentation
var fileFormatter = {
    stdout: 'trace.out',
    inspectArgsMaxLen: 0,
    indentationChar: '\t'
};

// Call inject and pass the 2 formatters config objects
var njstrace = require('njstrace').inject({
    formatter: [consoleFormatter, fileFormatter]
});
```
The result of the above run would be both an output to the console and output to a "trace.out" file.

### Custom Formatter
Writing a custom formatter is easy, all you have to do is write a "class" that inherits from njstrace Formatter, and implement the `onEntry` and `onExit` methods.

**onEntry** - This method is called whenever a traced function is being called, the method gets a single `args` object with the following:
* `name {string}` - The traced function name

* `file {string}` - The traced file

* `line {number}` - The traced function line number

* `args {object}` - The function arguments object

* `stack {Tracer.CallStack}` - The current call stack including the current traced function (see Tracer.CallStack below)

**onExit** - This method is called whenever a traced function returns, the method gets a single `args` object with the following:
* `name {string}` - The traced function name

* `file {string}` - The traced file

* `line {number}` - The traced function line number

* `retLine {number}` - The line number where the exit is (can be either a return statement of function end)

* `stack {Tracer.CallStack}` - The current call stack AFTER popping the current traced function (see Tracer.CallStack below)

* `span {number}` - The execution time span (milliseconds) of the traced function

* `exception {boolean}` - Whether this exit is due to exception

* `returnValue {*|null}` - The function return value

**Tracer.CallStack** - A call stack object. This is an Array object where each element is a function stack id. In order to get the function name/file/line the `CallStack` object has a `stackMap` property which is a dictionary where the key is the stack id and the value is a string in the following format `fnName@fnFile:line`

### Example
Creating a simple formatter that writes to the console.

**main.js**
```javascript
// Get a reference to njstrace default Formatter class
var Formatter = require('njstrace/lib/formatter.js');

// Create my custom Formatter class
function MyFormatter() {
    // No need to call Formatter ctor here
}
// But must "inherit" from Formatter
require('util').inherits(MyFormatter, Formatter);

// Implement the onEntry method
MyFormatter.prototype.onEntry = function(args) {
    console.log('Got call to %s@%s::%s, num of args: %s, stack location: %s',
                args.name, args.file, args.line, args.args.length, args.stack.length);
};

// Implement the onExit method
MyFormatter.prototype.onExit = function(args) {
    console.log('Exit from %s@%s::%s, had exception: %s, exit line: %s, execution time: %s, has return value: %s',
                args.name, args.file, args.line, args.exception, args.retLine, args.span, args.returnValue !== null);
};

// Call inject and use MyFormatter as the formatter
var njstrace = require('njstrace').inject({ formatter: new MyFormatter() }),
    b = require('./b.js');

// Do some stuff on "b"
setTimeout(function(){
    b.foo();
}, 1000);
```

**b.js**
```javascript
function doFoo() {
    console.log('fooing');
    return 3;
}

exports.foo = function() {
    doFoo();
}
```
And the console output would be:
```
Got call to exports.foo@C:\MyProjects\njsTrace\test\b.js::6, num of args: 0, stack location: 1
Got call to doFoo@C:\MyProjects\njsTrace\test\b.js::1, num of args: 0, stack location: 2
fooing
Exit from doFoo@C:\MyProjects\njsTrace\test\b.js::1, had exception: false, exit line: 3, execution time: 0, has return value: true
Exit from exports.foo@C:\MyProjects\njsTrace\test\b.js::6, had exception: false, exit line: 8, execution time: 1, has return value: false
```

## What's next?
I started this project as an experiment, next I would want to see if I can create some GUI that will parse the tracing
output and display it nicely (forks are welcomed as I don't see myself getting to this :)).

Enjoy !
