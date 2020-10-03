const gulp = require('gulp');
const mocha = require('gulp-mocha');
const watchList = ['index.js', 'test/**', 'lib/**'];

let node = null;

const startServer = function(cb) {
  const spawn = require('child_process').spawn;
  if (node) {
    node.kill();
  }

  node = spawn('node', ['index.js'], {stdio: 'inherit'});
  cb();
  node.on('close', (code) => {
    if (code === 8) {
      gulp.log('Error detected, waiting for changes...');
    }
  });
};

const runTest = function() {
  return gulp.src(['test/**/*.js'], {read: false})
      .pipe(mocha({reporter: 'list', exit: false}))
      .on('error', console.error);
};

// clean up if an error goes unhandled.
process.on('exit', function() {
  if (node) {
    node.kill();
  }
});

const server = function(cb) {
  startServer(cb);
  return gulp.watch(watchList, gulp.series([startServer]));
};

exports.default = server;
exports.server = server;
exports.test = () => gulp.watch(watchList, () => runTest());
