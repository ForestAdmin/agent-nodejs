function parseVersion(version: string): [number, number, number] {
  const [major = 0, minor = 0, patch = 0] = (version.match(/\d+/g) ?? []).map(Number);

  return [major, minor, patch];
}

// Single source of truth for the floor: read it from package.json `engines.node` so the runtime
// guard can't drift from the version npm enforces at install time.
// eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-dynamic-require, global-require
const { engines } = require('../package.json') as { engines?: { node?: string } };

export const MINIMUM_NODE_VERSION = (engines?.node ?? '').replace(/^\D*/, '');

export function isSupportedNodeVersion(
  currentVersion: string,
  minimumVersion: string = MINIMUM_NODE_VERSION,
): boolean {
  const [curMajor, curMinor, curPatch] = parseVersion(currentVersion);
  const [minMajor, minMinor, minPatch] = parseVersion(minimumVersion);

  if (curMajor !== minMajor) return curMajor > minMajor;
  if (curMinor !== minMinor) return curMinor > minMinor;

  return curPatch >= minPatch;
}

export function unsupportedNodeVersionMessage(
  currentVersion: string,
  minimumVersion: string = MINIMUM_NODE_VERSION,
): string {
  return (
    `The Forest workflow executor requires Node.js ${minimumVersion} or higher, ` +
    `but the current version is ${currentVersion}. Please upgrade Node.js to continue.`
  );
}

interface CheckNodeVersionDeps {
  currentVersion?: string;
  minimumVersion?: string;
  printError?: (message: string) => void;
  exit?: (code: number) => void;
}

export default function checkNodeVersion(deps: CheckNodeVersionDeps = {}): void {
  const {
    currentVersion = process.version,
    minimumVersion = MINIMUM_NODE_VERSION,
    printError = (message: string) => {
      process.stderr.write(`${message}\n`);
    },
    exit = (code: number) => process.exit(code),
  } = deps;

  if (isSupportedNodeVersion(currentVersion, minimumVersion)) return;

  printError(unsupportedNodeVersionMessage(currentVersion, minimumVersion));
  exit(1);
}
