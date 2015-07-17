var gulp = require('gulp');
var ts = require('gulp-typescript');
var merge = require('merge2');
var notifier = require('node-notifier');
var sourcemaps = require('gulp-sourcemaps');
var typescript15 = require('typescript');

var tsProjectArk = ts.createProject({
    declarationFiles: true,
    noExternalResolve: false,
    module: 'commonjs',
    target: 'ES5',
    noEmitOnError: false,
    typescript: typescript15
});

gulp.task('ts', function() {
    var tsResult = gulp.src('src/**/*.ts')
        .pipe(sourcemaps.init())
        .pipe(ts(tsProjectArk));

    tsResult._events.error[0] = function(error) {
        notifier.notify({
            'title': 'Compilation error',
            'message': error.__safety.toString(),
            sound: true
        });
    };
    return merge([
        tsResult.dts.pipe(gulp.dest('lib/definitions')),
        tsResult.js.pipe(gulp.dest('lib/js'))
    ]);
});

gulp.task('staticdata', function() {
    return gulp.src('src/staticdata/**/*')
        .pipe(gulp.dest('lib/js/staticdata'))
});

gulp.task('default', ['ts', 'staticdata'], function() {

});