function a(z, ...rest) {
	console.log(arguments);

	var { x, ...remaining } = { x: 1, a: 2, b: 3, c: 4 };

	z += 1;
	return z;
}

function b(x) {
	return new Promise((res, rej) => {
		setTimeout(function() {
			++x;
			res(x);
		}, 100);
	});
}

a(12, 'a', 'b');

b(12).then(ret => {
	console.log(ret)
});
