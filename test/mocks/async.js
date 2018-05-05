function wait() {
	return new Promise(res => {
		setTimeout(() => res(3), 100);
	});
}

async function foo() {
	var x = await wait();
	return x + 1;
}

async function boo() {
	var x = await foo();
	return x + 1;
}

boo().then(res => {
	console.log(res);
});
