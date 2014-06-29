var colors = require('colors');

function a() {
	b();
}

function b() {
	try {
		c();
	} catch (e) {
		console.log('ERR:', e);
	}
	ba();
	return {func:'b'};
}

function c() {
	d();
	return 'c';
}

function d() {
	throw new Error('Error from d');
}

function ba() {return 'ba';}

exports.foo = function() {
	try {
		a();
	} catch (e) {
		console.log('ERROR:', e);
	}
};