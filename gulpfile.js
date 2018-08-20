/*eslint-env node */

const gulp = require('gulp');
const sass = require('gulp-sass');
const inlinesource = require('gulp-inline-source');
const autoprefixer = require('gulp-autoprefixer');
const browserSync = require('browser-sync').create();
const sourcemaps = require('gulp-sourcemaps');
const imagemin = require('gulp-imagemin');
const webp = require('gulp-webp');
const pngquant = require('imagemin-pngquant');
const browserify = require('browserify');
const babelify = require('babelify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');

/**
 * @copy style.css from css folder to sass and then point to dist
 */
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

gulp.task('copy-json', function() {
  return gulp.src('./manifest.json')
    .pipe(gulp.dest('./dist'));
});
/**
 * @copy html file and save it to dist
 */
gulp.task('copy-html', function() {
  return gulp.src('./*.html')
    .pipe(gulp.dest('./dist'));
});

gulp.task('inline', function() {
  return gulp.src('./*.html')
    .pipe(inlinesource())
    .pipe(gulp.dest('./dist'));
});
/**
 * @copy image folder and save it to dist
 */
gulp.task('copy-images', function() {
  return gulp.src('img/*')
    .pipe(webp())
    .pipe(gulp.dest('dist/img'));
});
/**
 * @copy sw.js, sourcemaps so it can be debugged in the web dev tool,
 * and save it to dist
 */
gulp.task('scripts:sw', function() {
  return gulp.src('sw.js')
    .pipe(sourcemaps.init())
    .pipe(sourcemaps.write('maps'))
    .pipe(gulp.dest('./dist'));
});
/**
 * @copy javascript file (main page), transpiler by using browserify
 * to allow using the latest js version, debug, and save it to dist
 */
gulp.task('scripts:main', function() {
  return browserify(['js/main.js', 'js/dbhelper.js'], {debug: true})
    .transform(babelify.configure({
      presets: ['env']
    }))
    .bundle()
    .pipe(source('main_bundle.js'))
    .pipe(buffer())
    .pipe(gulp.dest('./dist/js'));
});
/**
 * @copy javascript file(restaurant page), transpiler by using browserify
 * to allow using the latest js version, debug, and save it to dist
 */
gulp.task('scripts:restaurant', function() {
  return browserify(['js/restaurant_info.js', 'js/dbhelper.js'], {debug: true})
    .transform(babelify.configure({
      presets: ['env']
    }))
    .bundle()
    .pipe(source('restaurant_bundle.js'))
    .pipe(buffer())
    .pipe(gulp.dest('./dist/js'));
});
/**
 * @copy image folder, optimize and compress
 * so original visual information stays exactly the same, and save it to dist
 */
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
  'copy-json',
  'inline',
  'copy-images',
  'images-process',
  'styles',
  'scripts:sw',
  'scripts:main',
  'scripts:restaurant'
)));

gulp.task('test', gulp.series('dist'));
/**
 * @set the tasks to default when run gulp
 */
gulp.task('default', gulp.series(gulp.parallel(
  'copy-images',
  'copy-html',
  'copy-json',
  'styles',
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







