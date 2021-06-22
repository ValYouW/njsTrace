function boo() {
	return Promise.resolve(13);
}

function foo(x) {
	return Promise.resolve(x + 1);
}

function zoo(y) {
	return y + 1;
}

boo().then(res => {
 	return res + 1;
});

// boo().then(res => zoo(res + 1));

// boo().then(res => ({ x: res + 1 }));

// boo().then(() => (
//  	{ x: 123 }
// ));

// boo().then(res => {
//  	foo(res).then(r => zoo(r));
// });
