var colors = require('colors');

function a() {
	b();
}

function b() {
//	try {
		c();
//	} catch (e) {
		//console.log('ERR:', e);
//	}
	ba();
}

function c() {
	d();
}

function d() {
	throw new Error('Error from d');
}

function ba() {}

exports.foo = function() {
	try {
		a();
	} catch (e) {
		console.log('ERROR:', e);
	}
}