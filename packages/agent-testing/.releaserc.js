const packageName = __dirname.split('/').pop();

module.exports = { ...require('../../.releaserc.js'), tagFormat: packageName + '@${version}' }