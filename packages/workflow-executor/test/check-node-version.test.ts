/**
 * TDD (red) for PRD-496 — workflow-executor must enforce and communicate a minimum Node.js version.
 *
 * These tests define the contract for a new, *intentionally dependency-free* preflight module
 * `src/check-node-version.ts`. It must have no heavy imports (no koa, no @langchain/openai, no
 * build-workflow-executor) so the CLI entry can run the guard BEFORE those modules are evaluated —
 * otherwise an old runtime crashes on those imports first, which is the bug being fixed.
 *
 * Expected public surface (to be implemented in a later step):
 *   - export const MINIMUM_NODE_MAJOR: number
 *   - export function isSupportedNodeVersion(currentVersion: string, minimumMajor?: number): boolean
 *   - export function unsupportedNodeVersionMessage(currentVersion: string, minimumMajor?: number): string
 *   - export default function checkNodeVersion(deps?: {
 *       currentVersion?: string;          // defaults to the running version
 *       minimumMajor?: number;            // defaults to MINIMUM_NODE_MAJOR
 *       printError?: (message: string) => void;  // defaults to writing to stderr
 *       exit?: (code: number) => void;           // defaults to process.exit
 *     }): void
 *
 * The floor value itself (20 vs 22 vs 24) is an open product decision, so these tests never assert
 * an absolute floor: pure-function tests pass the minimum explicitly, and the engines check asserts
 * agreement with MINIMUM_NODE_MAJOR rather than a literal.
 */
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

describe('robustness to malformed version input (policy undecided)', () => {
  // process.version is always well-formed, so these only matter if the pure function is reused.
  // The desired behaviour — throw a clear error vs. fail closed (treat as unsupported) — is an
  // implementation decision; left as titles until that is settled.
  it.todo('rejects an empty version string');

  it.todo('rejects a non-version string such as "garbage"');
});

describe('preflight ordering (verified end-to-end, not in unit scope)', () => {
  // The guard only fixes the bug if it runs before the heavy CLI imports (koa, @langchain/openai)
  // are evaluated. The exact wiring (separate bootstrap module vs. inline in the bin) is an
  // implementation decision and is best validated on a real old Node runtime by hand.
  it.todo('runs the version guard before requiring build-workflow-executor / koa / @langchain');
});
