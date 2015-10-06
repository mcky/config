
var browserify = require('browserify')
	, argv = require('yargs').argv
	, buffer = require('vinyl-buffer')
	, gp = require('gulp-load-plugins')()
	, gulp = require('gulp')
	, sequence = require('run-sequence')
	, source = require('vinyl-source-stream')
	, watchify = require('watchify')
	, browserSync = require('browser-sync').create()
	, babelify = require('babelify')
	, lrload = require('livereactload')

var deploy = false

const jsFile = 'main.js'
	, src = './app/src'
	, publicDir = './app/public'
	, proxy = 'context.dev'

gulp.task('assets', ['styles', 'scripts', 'media'])

gulp.task('media', () => gulp.src([`${src}/{images,fonts,admin}/**/*`]).pipe(gulp.dest(publicDir)))

gulp.task('styles', function() {
	return gulp.src('app/src/styles/main.scss')
		.pipe(gp.plumber({errorHandler: gp.notify.onError('Error: <%= error.message %>')}))
		.pipe(gp.sass({
			errLogToConsole: true,
			includePaths: require('node-neat').includePaths,
		}))
		.pipe(gp.if(!deploy, gp.sourcemaps.init({ loadMaps: true })))
		.pipe(gp.autoprefixer())
		.pipe(gp.if(deploy, gp.minifyCss()))
		.pipe(gp.if(!deploy, gp.sourcemaps.write('.')))
		.pipe(gp.if(!deploy, browserSync.stream({match: '**/*.css'})))
		.pipe(gulp.dest(`${publicDir}/styles`))
})

var bundleErrHandler = function(err) {
	gp.util.log(err.toString())
	gp.notify.onError('Error: <%= error.message %>')
	deploy ? process.exit(1) : this.end()
}

gulp.task('eslint', function () {
	const eslint = gp.eslint

	return gulp.src(`${src}/**/*.js`)
		.pipe(eslint())
		.pipe(eslint.format())
		.pipe(eslint.failAfterError())
})

gulp.task('scripts', function() {

	const babelOpts = {
		optional: [
			'es7.objectRestSpread',
			'es7.decorators',
			'es7.classProperties',
		],
	}

	const transforms = deploy || !argv.sync ?
		[babelify.configure(babelOpts)]
		:
		[babelify.configure(babelOpts), lrload]

	const bundler = browserify({
		entries: [`${src}/scripts/${jsFile}`],
		transform: transforms,
		debug: true,
		cache: {}, packageCache: {}, fullPaths: true,
	})

	const watcher = deploy ? bundler : watchify(bundler)

	const compile = function(bundle) {
		bundle
			.bundle()
			.on('error', bundleErrHandler)
			.pipe(source(jsFile))
			.pipe(buffer())
			.pipe(gp.if(deploy, gp.uglify()))
			.pipe(gulp.dest(`${publicDir}/scripts`))
		gp.util.log(`Browserify built: ${(new Date).toTimeString()}`)
		return bundle
	}

	watcher.on('update', () => compile(watcher))
	compile(watcher)
})

gulp.task('default', function(callback) {

	gulp.watch(`${publicDir}/styles/**/*.scss`, ['styles'])
	gulp.watch(`${publicDir}/fonts/**/*`, ['fonts'])
	gulp.watch(`${publicDir}/images/**/*`, ['images'])
	gulp.watch('templates/**/*.html').on('change', browserSync.reload)

	if (argv.sync) {
		browserSync.init({ proxy: proxy, ghostMode: false })
		// browserSync.init({ server: {baseDir: 'app', port: 5000}, ghostMode: false })
		lrload.monitor(`${publicDir}/scripts/${jsFile}`)
	}

	sequence(['eslint', 'assets'], callback)
})

gulp.task('build', function(callback) {
	deploy = true
	sequence(['eslint', 'assets'], callback)
})
