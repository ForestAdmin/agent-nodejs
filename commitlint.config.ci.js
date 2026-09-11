const commitLintConfig = require('./commitlint.config');

module.exports = {
  ...commitLintConfig,
  rules: {
    ...commitLintConfig.rules,
    'scope-empty': [2, 'never'],
  },
};
