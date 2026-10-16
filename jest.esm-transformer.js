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
};
