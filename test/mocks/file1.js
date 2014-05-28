function whatTime(cb) {
	console.log('In whatTime');
	if (Date.now() < 0) return;

	if (Date.now() > Number.MAX_VALUE) {
		cb(Date.now());
		return ('asdasdasdas' || console.log('blabla')) && false;
	} else {
        throw new Error('bla bla');
    }

	cb('Welcome to the FUTURE !!');
}

var Mod = module.exports = {};
Mod.foo = function() {
	try {
		whatTime(function (time) {
			console.log('In Mod.foo anonymous function', time);
		});
	} catch (e) {}

	try {
		whatTime(function onTime(time) {
			console.log('In Mod.foo onTime function', time);
			//if (time > 0) throw new Error('Time is positive !');
		});
	} catch (ex) {}
};

var foo = function(x) {
	console.log('InFoo');
	if (x>0)
		return 1;
	else
		return 2;
};

(function() {
	console.log('Some Anon IIFE');
})();

(function nonAnonIIFE() {
	console.log('in nonAnonIIFE');
})();

foo();