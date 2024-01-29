const path = require('path');

module.exports = {
  extends: path.join(__dirname, '../../.eslintrc.js'),
  rules: {
    'no-console': 'off',
  },
};
