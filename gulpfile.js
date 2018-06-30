/*eslint-env node */

var gulp = require('gulp');
var sass = require('gulp-sass');
var autoprefixer = require('gulp-autoprefixer');
var browserSync = require('browser-sync').create();
//var eslint = require('gulp-eslint');
var sourcemaps = require('gulp-sourcemaps');
var imagemin = require('gulp-imagemin');
var pngquant = require('imagemin-pngquant');
var browserify = require('browserify');
var babelify = require('babelify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');


gulp.task('styles', function() {
  return gulp.src('sass/**/*.scss')
    .pipe(sourcemaps.init())
    .pipe(sass({
      outputStyle: 'compressed'
    }).on('error', sass.logError))
    .pipe(autoprefixer({
      browsers: ['last 2 versions']
    }))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('dist/css'));
});

gulp.task('copy-html', function() {
  return gulp.src('./*.html')
    .pipe(gulp.dest('./dist'));
});

gulp.task('copy-images', function() {
  return gulp.src('img/*')
    .pipe(gulp.dest('dist/img'));
});

gulp.task('copy-scripts', function() {
  browserify(['js/**/*.js', 'sw.js'])
    .transform(babelify.configure({
      presets: ['env']
    }))
    .pipe(sourcemaps.init())
    .pipe(sourcemaps.write('maps'))
    .pipe(gulp.dest('dist2/js'));
});

gulp.task('scripts:sw', function() {
  return gulp.src('./sw.js')
    .pipe(gulp.dest('./dist/js'));
});

gulp.task('scripts:main', function() {
  return browserify(['js/main.js', 'js/dbhelper.js'])
    .transform(babelify.configure({
      presets: ['env']
    }))
    .bundle()
    .pipe(source('main_bundle.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init())
    .pipe(sourcemaps.write('maps'))
    .pipe(gulp.dest('./dist/js'));
});

gulp.task('scripts:restaurant', function() {
  return browserify(['js/restaurant_info.js', 'js/dbhelper.js'])
    .transform(babelify.configure({
      presets: ['env']
    }))
    .bundle()
    .pipe(source('restaurant_bundle.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init())
    .pipe(sourcemaps.write('maps')) // You need this if you want to continue using the stream with other plugins
    .pipe(gulp.dest('./dist/js'));
});

gulp.task('images-process', function() {
  return gulp.src('img/*')
    .pipe(imagemin({
      progressive: true,
      use: [pngquant()]
    }))
    .pipe(gulp.dest('dist/img'));
});

gulp.task('dist', gulp.series(gulp.parallel(
  'copy-html',
  'images-process',
  'styles',
  'scripts:main',
  'scripts:restaurant'
)));

gulp.task('test', gulp.series('dist'));

gulp.task('default', gulp.series(gulp.parallel(
  'styles',
  'copy-html',
  'copy-images',
  'scripts:main',
  'scripts:restaurant',
  'scripts:sw'), function() {
  gulp.watch('sass/**/*.scss', gulp.series('styles'));
  gulp.watch('./*.html', gulp.series('copy-html'));
  gulp.watch('./js/**/*.js', gulp.series('scripts:main', 'scripts:restaurant'));
  gulp.watch('./sw.js', gulp.series('scripts:main', 'scripts:restaurant'));
  gulp.watch('./dist/*.html').on('change', browserSync.reload);
  gulp.watch('./dist/js/*.js').on('change', browserSync.reload);

  browserSync.init({
    server: './dist'
  });
  browserSync.stream();
}));







