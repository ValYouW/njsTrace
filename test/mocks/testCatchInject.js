function foo() {
	try {
		var x = 3;
	} catch(ex) {
		console.log(ex);
	}
}

var boo = function() {
	var x = 3;
	try {
		var y = 4;
		setTimeout(() => {
			try {
				var r = 3;
			} catch(ex) {
				var z = 3;
			}
		}, 1000);
	} catch(e) {
		var z = 4;
	}
};

function zoo() {
	function inner() {
		try {
			var x = 3;
		} catch(ex) {
			var y = 4;
		}
	}

	inner();
}

try {
	throw new Error('err');
} catch(ex) {
	var y = 3;
}
