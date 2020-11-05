module.exports = {
  'parser': 'babel-eslint',
  'env': {
    'browser': true,
    'commonjs': true,
    'es2021': true,
    'node': true,
  },
  'extends': [
    'plugin:react/recommended',
    'google',
  ],
  'parserOptions': {
    'ecmaFeatures': {
      'jsx': true,
    },
    'ecmaVersion': 12,
  },
  'plugins': [
    'react',
  ],
  'rules': {
  },
};
