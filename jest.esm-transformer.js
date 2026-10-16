const { createHash } = require('crypto');
const ts = require('typescript');

const compilerOptions = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
  esModuleInterop: true,
  inlineSourceMap: true,
};

module.exports = {
  process(sourceText, sourcePath) {
    return {
      code: ts.transpileModule(sourceText, { fileName: sourcePath, compilerOptions }).outputText,
    };
  },
  getCacheKey(sourceText, sourcePath, { configString, instrument }) {
    return createHash('sha1')
      .update(sourceText)
      .update(sourcePath)
      .update(configString)
      .update(instrument ? 'instrument' : '')
      .update(ts.version)
      .update(JSON.stringify(compilerOptions))
      .digest('hex');
  },
};
