# njsTrace - Instrumentation and Tracing

**Still in alpha**

njsTrace lets you easily instrument and trace you code, see all the function calls, arguments and return values,
as well as the time spent in each function.

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

mymod.run(parseFloat(Math.random().toFixed(4)));
```
** mymod.js **
```javascript
// *** mymod.js ***
var MyMod = module.exports = {};

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

MyMod.run = function(number) {
    number = first(number);
    printResult(number);
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
