const gulp = require('gulp');
const mocha = require('gulp-mocha');
const watchList = ['index.js', 'test/**', 'lib/**'];

let node = null;

const server = function(cb) {
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

const watchTests = function() {
  gulp.watch(watchList, () => {
    return gulp.src(tests)
        .pipe(mocha({reporter: 'list'}))
        .on('error', (err) => {
          console.log(err.stack);
        });
  });
};

// clean up if an error goes unhandled.
process.on('exit', function() {
  if (node) {
    node.kill();
  }
});

exports.server = server;
exports.start = gulp.series(server, test);
exports.watchTest = watchTests;
exports.watchServer = gulp.watch(watchList, server);
