// The minimum Node major is the single source of truth in package.json `engines.node` (which npm
// also reads at install time); derive it here so the runtime guard can never drift from it.
// Requiring a JSON file keeps this module free of heavy imports, so the CLI entry can run the guard
// before koa / @langchain/openai are evaluated — on an unsupported runtime those would crash first.
// eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-dynamic-require, global-require
const { engines } = require('../package.json') as { engines?: { node?: string } };

export const MINIMUM_NODE_MAJOR = Number.parseInt(/\d+/.exec(engines?.node ?? '')?.[0] ?? '', 10);

function parseMajor(version: string): number {
  return Number.parseInt(version.replace(/^v/, ''), 10);
}

export function isSupportedNodeVersion(
  currentVersion: string,
  minimumMajor: number = MINIMUM_NODE_MAJOR,
): boolean {
  return parseMajor(currentVersion) >= minimumMajor;
}

export function unsupportedNodeVersionMessage(
  currentVersion: string,
  minimumMajor: number = MINIMUM_NODE_MAJOR,
): string {
  return (
    `The Forest workflow executor requires Node.js ${minimumMajor} or higher, ` +
    `but the current version is ${currentVersion}. Please upgrade Node.js to continue.`
  );
}

interface CheckNodeVersionDeps {
  currentVersion?: string;
  minimumMajor?: number;
  printError?: (message: string) => void;
  exit?: (code: number) => void;
}

export default function checkNodeVersion(deps: CheckNodeVersionDeps = {}): void {
  const {
    currentVersion = process.version,
    minimumMajor = MINIMUM_NODE_MAJOR,
    printError = (message: string) => {
      process.stderr.write(`${message}\n`);
    },
    exit = (code: number) => process.exit(code),
  } = deps;

  if (isSupportedNodeVersion(currentVersion, minimumMajor)) return;

  printError(unsupportedNodeVersionMessage(currentVersion, minimumMajor));
  exit(1);
}
