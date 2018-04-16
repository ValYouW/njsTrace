function a(x) {
	x += 1;
	return x;
}

function b(x) {
	return new Promise((res, rej) => {
		setTimeout(function() {
			++x;
			res(x);
		}, 100);
	});
}

a(12);

b(12).then(ret => {
	console.log(ret)
});
