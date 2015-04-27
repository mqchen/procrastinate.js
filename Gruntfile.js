module.exports = function (grunt) {

	grunt.initConfig({
		buster: {
			procrastinate: {
				config: 'test/buster.js'
			}
		},
		coveralls: {
			procrastinate: {
				src: 'coverage/lcov.info'
			}
		},
		watch: {
			files: ['*.js', 'test/**/*.js'],
			tasks: ['test', 'build']
		},
		browserify: {
			options: {
				require: ['./index.js:procrastinate']
			},
			build: {
				src: 'index.js',
				dest: 'build/browser/procrastinate.js',
			}
		},
		uglify: {
			options: {
				mangle: false,
				banner: '/*! procrastinate.js <%= grunt.template.today("yyyy-mm-dd") %> */ '
			},
			build: {
				src: 'build/browser/procrastinate.js',
				dest: 'build/browser/procrastinate.min.js'
			}
		}
	});

	grunt.loadNpmTasks('grunt-buster');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-notify');
	grunt.loadNpmTasks('grunt-browserify');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-coveralls');

	grunt.registerTask('test', 'buster');
	grunt.registerTask('minify', 'uglify');
	grunt.registerTask('build', ['browserify', 'minify']);
};