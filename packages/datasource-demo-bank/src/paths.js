/** Where the data source finds its model files and its Custom component sources. */
const path = require('path');

module.exports = {
  MODEL: path.join(__dirname, 'model'),
  COMPONENTS: path.join(__dirname, 'components'),
};
