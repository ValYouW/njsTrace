var path=require('path');
module.exports = function(grunt) {
	// Project configuration.
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		jshint: {
			options: {
				force: true,
				bitwise: true,
				curly: true,
				eqeqeq: true,
				forin: true,
				noarg: true,
				noempty: true,
				nonew: true,
				undef: true,
				browser: true,
				node: true,
				white: true,
				quotmark: 'single',
				immed: true,
				newcap: true,
				trailing: true,
                smarttabs: true,
				'-W013': true,  // W013: Missing space after 'function'.
				'-W015': false, // W015: Expected 'case' to have an indentation at 5 instead at 9.
				'-W083': true,  // W083: Don't make functions within a loop.
				'-W089': true  // W089: The body of a for in should be wrapped in an if statement to filter unwanted properties from the prototype.
			},
			files: ['**/*.js', '!node_modules/**', '!doc/**', '!test/mocks/**']
        },
		clean: ['doc'],
		jsdoc : {
			dist : {
				src: ['njsTrace.js'],
				jsdoc: 'node_modules/.bin/jsdoc',
				options: {
					destination: 'doc',
					private: false,
					template : 'node_modules/grunt-jsdoc/node_modules/ink-docstrap/template',
					configure : 'jsdoc.conf.json'
				}
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-jsdoc');

	grunt.registerTask('default', []);
	grunt.registerTask('build', ['clean', 'jshint', 'concat', 'uglify', 'copy']);
	grunt.registerTask('run', ['build', 'shell']);
	grunt.registerTask('dev', ['build', 'concurrent']);
};