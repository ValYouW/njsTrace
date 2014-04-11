function whatTime(cb) {
	if (Date.now() < Number.MAX_VALUE) {
		cb(Date.now());
		return 'asdasdasdas';
	} else {
        throw new Error('bla bla');
    }

	cb('Welcome to the FUTURE !!');
}

var Mod = module.exports = {};
Mod.foo = function() {
	whatTime(function(time) {
		console.log('In Mod.foo anonymous function', time);
	});

	whatTime(function onTime(time) {
		console.log('In Mod.foo onTime function', time);
	});
};