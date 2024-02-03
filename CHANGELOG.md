v3.0.0
===
**BREAKING** - Using EcmaVersion 2022 by default when parsing javascript.

Added a new config `ecmaVersion` to `njsTrace.inject` that controls the parser version to use with `Espree`.

v2.0.1
===
support arrow functions where body is not a BlockStatement. Fixes #12

v2.0.0
===
Use `espree` for parsing javascript code instead of `node-falafel`.

v1.1.0
===
1. Update esprima parser verion to 9
1. Fixed "rest" parameter logging

(Older versions)
===
No CHANGELOG was maintained...
