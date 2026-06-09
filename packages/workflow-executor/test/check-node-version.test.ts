// The minimum Node major is read from package.json `engines.node`, so the guard's module is the
// single source of truth shared with the install-time engines declaration. Version inputs below
// are expressed relative to MINIMUM_NODE_MAJOR so the suite stays correct whatever floor is set.
import checkNodeVersion, {
  MINIMUM_NODE_MAJOR,
  isSupportedNodeVersion,
  unsupportedNodeVersionMessage,
} from '../src/check-node-version';

describe('isSupportedNodeVersion', () => {
  it('returns true when the major version is above the minimum', () => {
    expect(isSupportedNodeVersion(`${MINIMUM_NODE_MAJOR + 2}.3.0`, MINIMUM_NODE_MAJOR)).toBe(true);
  });

  it('returns true at the minimum major regardless of minor/patch (boundary)', () => {
    expect(isSupportedNodeVersion(`${MINIMUM_NODE_MAJOR}.0.0`, MINIMUM_NODE_MAJOR)).toBe(true);
    expect(isSupportedNodeVersion(`${MINIMUM_NODE_MAJOR}.0.1`, MINIMUM_NODE_MAJOR)).toBe(true);
    expect(isSupportedNodeVersion(`${MINIMUM_NODE_MAJOR}.1.0`, MINIMUM_NODE_MAJOR)).toBe(true);
  });

  it('returns false one major below the minimum (boundary)', () => {
    expect(isSupportedNodeVersion(`${MINIMUM_NODE_MAJOR - 1}.9.9`, MINIMUM_NODE_MAJOR)).toBe(false);
  });

  it('returns false for a much older major', () => {
    expect(isSupportedNodeVersion(`${MINIMUM_NODE_MAJOR - 4}.20.2`, MINIMUM_NODE_MAJOR)).toBe(
      false,
    );
  });

  it('compares by major only, so an old major with a high minor is still unsupported', () => {
    expect(isSupportedNodeVersion(`${MINIMUM_NODE_MAJOR - 2}.99.99`, MINIMUM_NODE_MAJOR)).toBe(
      false,
    );
  });

  it("ignores a leading 'v', matching both process.version and process.versions.node forms", () => {
    expect(isSupportedNodeVersion(`v${MINIMUM_NODE_MAJOR}.0.0`, MINIMUM_NODE_MAJOR)).toBe(true);
    expect(isSupportedNodeVersion(`v${MINIMUM_NODE_MAJOR}.0.0`, MINIMUM_NODE_MAJOR)).toBe(
      isSupportedNodeVersion(`${MINIMUM_NODE_MAJOR}.0.0`, MINIMUM_NODE_MAJOR),
    );
  });
});

describe('unsupportedNodeVersionMessage', () => {
  it('names both the required minimum and the detected version, with actionable wording', () => {
    const detected = `v${MINIMUM_NODE_MAJOR - 2}.20.0`;
    const message = unsupportedNodeVersionMessage(detected, MINIMUM_NODE_MAJOR);

    expect(message).toContain(String(MINIMUM_NODE_MAJOR));
    expect(message).toContain(detected);
    expect(message).toMatch(/required|higher/i);
  });
});

describe('checkNodeVersion', () => {
  it('neither prints nor exits when the running version is supported (happy path)', () => {
    const printError = jest.fn();
    const exit = jest.fn();

    checkNodeVersion({ currentVersion: `v${MINIMUM_NODE_MAJOR}.0.0`, printError, exit });

    expect(printError).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('prints the unsupported-version message and exits with code 1 when too old', () => {
    const detected = `v${MINIMUM_NODE_MAJOR - 2}.20.0`;
    const printError = jest.fn();
    const exit = jest.fn();

    checkNodeVersion({ currentVersion: detected, printError, exit });

    expect(printError).toHaveBeenCalledTimes(1);
    expect(printError).toHaveBeenCalledWith(unsupportedNodeVersionMessage(detected));
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('treats one major below the floor as unsupported', () => {
    const exit = jest.fn();

    checkNodeVersion({
      currentVersion: `${MINIMUM_NODE_MAJOR - 1}.9.9`,
      printError: jest.fn(),
      exit,
    });

    expect(exit).toHaveBeenCalledWith(1);
  });

  it('is idempotent across repeated calls on a supported version', () => {
    const printError = jest.fn();
    const exit = jest.fn();

    checkNodeVersion({ currentVersion: `v${MINIMUM_NODE_MAJOR + 2}.0.0`, printError, exit });
    checkNodeVersion({ currentVersion: `v${MINIMUM_NODE_MAJOR + 2}.0.0`, printError, exit });

    expect(printError).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });
});

describe('MINIMUM_NODE_MAJOR', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-dynamic-require, global-require
  const pkg = require('../package.json') as { engines?: { node?: string } };

  it('declares a minimum Node.js version in engines.node', () => {
    expect(typeof pkg.engines?.node).toBe('string');
    expect(pkg.engines?.node).toMatch(/\d/);
  });

  it('is derived from package.json engines as the current floor of 20', () => {
    expect(MINIMUM_NODE_MAJOR).toBe(20);
  });
});
