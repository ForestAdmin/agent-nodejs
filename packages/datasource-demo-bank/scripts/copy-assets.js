/* eslint-disable @typescript-eslint/no-var-requires -- a plain Node script run after tsc */
/**
 * Copies the data model files tsc leaves behind (src/model/**\/*.json: data-model.json) into dist/.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const DIST = path.join(__dirname, '..', 'dist');

function copyAssets(folder) {
  fs.readdirSync(folder, { withFileTypes: true }).forEach(entry => {
    const from = path.join(folder, entry.name);

    if (entry.isDirectory()) {
      copyAssets(from);
    } else if (entry.name.endsWith('.json')) {
      const to = path.join(DIST, path.relative(SRC, from));
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  });
}

copyAssets(path.join(SRC, 'model'));
