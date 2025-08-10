const opts = {
  checkCoverage: true,
  branches: 80,
  lines: 80,
  functions: 80,
  statements: 80,
};

console.log('nyc config: ', opts);
module.exports = opts;
