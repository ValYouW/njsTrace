function* anotherGenerator(i) {
	yield i + 1;
	yield i + 2;
	yield i + 3;
}

function* generator(i) {
	yield i;
	yield* anotherGenerator(i);
	yield i + 10;
}

function start() {
	var gen = generator(10);
	var val = gen.next().value;
	while (val) {
		console.log(val);
		val = gen.next().value;
	}
}

start();
