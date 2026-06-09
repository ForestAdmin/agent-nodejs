// The guard's module must stay dependency-free so the CLI entry can run it before the heavy
// imports (koa, @langchain/openai) are evaluated; on an old runtime those imports crash first.
// The floor is asserted only relative to MINIMUM_NODE_MAJOR, never as a literal, since the chosen
// version is a product decision.
import checkNodeVersion, {
  MINIMUM_NODE_MAJOR,
  isSupportedNodeVersion,
  unsupportedNodeVersionMessage,
} from '../src/check-node-version';

describe('isSupportedNodeVersion', () => {
  it('returns true when the major version is above the minimum', () => {
    expect(isSupportedNodeVersion('22.3.0', 20)).toBe(true);
  });

  it('returns true at exactly the minimum major (boundary)', () => {
    expect(isSupportedNodeVersion('20.0.0', 20)).toBe(true);
  });

  it('returns false one major below the minimum (boundary)', () => {
    expect(isSupportedNodeVersion('19.9.9', 20)).toBe(false);
  });

  it('returns false for a much older major', () => {
    expect(isSupportedNodeVersion('16.20.2', 20)).toBe(false);
  });

  it('compares by major only, so an old major with a high minor is still unsupported', () => {
    expect(isSupportedNodeVersion('18.99.99', 20)).toBe(false);
  });

  it("ignores a leading 'v', matching both process.version and process.versions.node forms", () => {
    expect(isSupportedNodeVersion('v20.0.0', 20)).toBe(true);
    expect(isSupportedNodeVersion('v20.0.0', 20)).toBe(isSupportedNodeVersion('20.0.0', 20));
  });
});

describe('unsupportedNodeVersionMessage', () => {
  it('names both the required minimum and the detected version, with actionable wording', () => {
    const message = unsupportedNodeVersionMessage('v18.20.0', 20);

    expect(message).toContain('20');
    expect(message).toContain('18.20.0');
    expect(message).toMatch(/required|higher/i);
  });
});

describe('checkNodeVersion', () => {
  it('neither prints nor exits when the running version is supported (happy path)', () => {
    const printError = jest.fn();
    const exit = jest.fn();

    checkNodeVersion({ currentVersion: 'v20.0.0', minimumMajor: 20, printError, exit });

    expect(printError).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('prints the unsupported-version message and exits with code 1 when too old', () => {
    const printError = jest.fn();
    const exit = jest.fn();

    checkNodeVersion({ currentVersion: 'v18.20.0', minimumMajor: 20, printError, exit });

    expect(printError).toHaveBeenCalledTimes(1);
    expect(printError).toHaveBeenCalledWith(unsupportedNodeVersionMessage('v18.20.0', 20));
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('treats one major below MINIMUM_NODE_MAJOR as unsupported by default', () => {
    const exit = jest.fn();

    checkNodeVersion({
      currentVersion: `${MINIMUM_NODE_MAJOR - 1}.0.0`,
      printError: jest.fn(),
      exit,
    });

    expect(exit).toHaveBeenCalledWith(1);
  });

  it('treats MINIMUM_NODE_MAJOR as supported by default', () => {
    const exit = jest.fn();

    checkNodeVersion({ currentVersion: `${MINIMUM_NODE_MAJOR}.0.0`, printError: jest.fn(), exit });

    expect(exit).not.toHaveBeenCalled();
  });

  it('is idempotent across repeated calls on a supported version', () => {
    const printError = jest.fn();
    const exit = jest.fn();

    checkNodeVersion({ currentVersion: 'v22.0.0', minimumMajor: 20, printError, exit });
    checkNodeVersion({ currentVersion: 'v22.0.0', minimumMajor: 20, printError, exit });

    expect(printError).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });
});

describe('package.json engines', () => {
  // cli-core.ts already reads package.json this way; mirror it to avoid JSON-import config.
  // eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-dynamic-require, global-require
  const pkg = require('../package.json') as { engines?: { node?: string } };

  it('declares a minimum Node.js version in engines.node', () => {
    expect(typeof pkg.engines?.node).toBe('string');
    expect(pkg.engines?.node).toMatch(/\d/);
  });

  it('declares an engines.node minimum that agrees with the runtime guard floor', () => {
    const enginesMajor = Number(/(\d+)/.exec(pkg.engines?.node ?? '')?.[1]);

    expect(enginesMajor).toBe(MINIMUM_NODE_MAJOR);
  });
});
