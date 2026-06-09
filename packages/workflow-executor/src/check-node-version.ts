// Driven by the heaviest runtime dependency floor: @langchain/openai requires Node >= 20
// (koa requires >= 18). Keep this module free of heavy imports so the CLI entry can run the
// guard before those modules are evaluated on an unsupported runtime.
export const MINIMUM_NODE_MAJOR = 20;

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
