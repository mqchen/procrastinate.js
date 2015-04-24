module.exports = function (grunt) {

	grunt.initConfig({
		buster: {
			procrastinate: {
				config: 'test/buster.js'
			}
		},
		watch: {
			files: ['**/*.js'],
			tasks: ['test']
		}
	});

	grunt.loadNpmTasks('grunt-buster');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-notify');
	grunt.registerTask('test', 'buster');
};