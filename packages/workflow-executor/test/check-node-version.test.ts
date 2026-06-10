// The minimum Node version is read from package.json `engines.node`, so the guard's module is the
// single source of truth shared with the install-time engines declaration. Version inputs below
// are expressed relative to the parsed floor so the suite stays correct whatever floor is set.
import checkNodeVersion, {
  MINIMUM_NODE_VERSION,
  isSupportedNodeVersion,
  unsupportedNodeVersionMessage,
} from '../src/check-node-version';

const [FLOOR_MAJOR, FLOOR_MINOR] = MINIMUM_NODE_VERSION.split('.').map(Number);

describe('isSupportedNodeVersion', () => {
  it('returns true when the major version is above the minimum', () => {
    expect(isSupportedNodeVersion(`${FLOOR_MAJOR + 1}.0.0`)).toBe(true);
  });

  it('returns true at the exact minimum major.minor (boundary)', () => {
    expect(isSupportedNodeVersion(`${FLOOR_MAJOR}.${FLOOR_MINOR}.0`)).toBe(true);
  });

  it('returns true above the minimum minor within the same major', () => {
    expect(isSupportedNodeVersion(`${FLOOR_MAJOR}.${FLOOR_MINOR + 1}.0`)).toBe(true);
  });

  it('returns false below the minimum minor within the same major', () => {
    expect(isSupportedNodeVersion(`${FLOOR_MAJOR}.${FLOOR_MINOR - 1}.9`)).toBe(false);
  });

  it('returns false one major below the minimum', () => {
    expect(isSupportedNodeVersion(`${FLOOR_MAJOR - 1}.99.9`)).toBe(false);
  });

  it("ignores a leading 'v', matching both process.version and process.versions.node forms", () => {
    expect(isSupportedNodeVersion(`v${FLOOR_MAJOR}.${FLOOR_MINOR}.0`)).toBe(true);
  });
});

describe('unsupportedNodeVersionMessage', () => {
  it('names both the required minimum and the detected version, with actionable wording', () => {
    const detected = `v${FLOOR_MAJOR}.${FLOOR_MINOR - 1}.0`;
    const message = unsupportedNodeVersionMessage(detected);

    expect(message).toContain(MINIMUM_NODE_VERSION);
    expect(message).toContain(detected);
    expect(message).toMatch(/required|higher/i);
  });
});

describe('checkNodeVersion', () => {
  it('neither prints nor exits when the running version is supported (happy path)', () => {
    const printError = jest.fn();
    const exit = jest.fn();

    checkNodeVersion({ currentVersion: `v${FLOOR_MAJOR}.${FLOOR_MINOR}.0`, printError, exit });

    expect(printError).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('prints the unsupported-version message and exits with code 1 below the minimum minor', () => {
    const detected = `v${FLOOR_MAJOR}.${FLOOR_MINOR - 1}.0`;
    const printError = jest.fn();
    const exit = jest.fn();

    checkNodeVersion({ currentVersion: detected, printError, exit });

    expect(printError).toHaveBeenCalledTimes(1);
    expect(printError).toHaveBeenCalledWith(unsupportedNodeVersionMessage(detected));
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('exits with code 1 when a full major below the minimum', () => {
    const exit = jest.fn();

    checkNodeVersion({ currentVersion: `${FLOOR_MAJOR - 1}.99.9`, printError: jest.fn(), exit });

    expect(exit).toHaveBeenCalledWith(1);
  });

  it('is idempotent across repeated calls on a supported version', () => {
    const printError = jest.fn();
    const exit = jest.fn();

    checkNodeVersion({ currentVersion: `v${FLOOR_MAJOR + 1}.0.0`, printError, exit });
    checkNodeVersion({ currentVersion: `v${FLOOR_MAJOR + 1}.0.0`, printError, exit });

    expect(printError).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });
});

describe('MINIMUM_NODE_VERSION', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-dynamic-require, global-require
  const pkg = require('../package.json') as { engines?: { node?: string } };

  it('declares a minimum Node.js version in engines.node', () => {
    expect(typeof pkg.engines?.node).toBe('string');
    expect(pkg.engines?.node).toMatch(/\d/);
  });

  it('is derived from package.json engines as the current floor of 22.12', () => {
    expect(MINIMUM_NODE_VERSION).toBe('22.12.0');
  });
});
