var fs = require('fs');

class JSON_Handler {
	constructor(path,obj=undefined) {
		this.path = path;
		this.obj = obj;

		if (obj === undefined) this.read();
	}

	flush() {
		fs.writeFileSync(this.path, JSON.stringify(this.obj, null, 4));
	}

	read() {
		let object, content;

		try {
			content = fs.readFileSync(this.path, 'utf8');
		} catch(e) {
			console.err(e);
		}

		try {
			this.obj = JSON.parse(content);
		} catch(e) {
			this.obj = {};
		}
	}
}

module.exports = {JSON_Handler};
