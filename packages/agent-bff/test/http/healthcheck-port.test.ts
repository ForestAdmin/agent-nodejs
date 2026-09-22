import { readFileSync } from 'fs';
import path from 'path';

import { parseConfig } from '../../src/config/env-config';

/**
 * The image's HEALTHCHECK builds its URL from HTTP_PORT itself, so it has to read the variable the
 * same way the server does — a probe on a different port than the one bound reports a perfectly
 * healthy container unhealthy, and nothing in the image would say why.
 *
 * The expression is lifted out of the Dockerfile rather than restated here, so editing one without
 * the other fails this test instead of shipping.
 */
const DOCKERFILE = path.resolve(__dirname, '../../Dockerfile');
const PORT_EXPRESSION = /'http:\/\/localhost:'\s*\+\s*\((.+?)\)\s*\+\s*'\/health'/;

function probePortExpression(): string {
  const match = readFileSync(DOCKERFILE, 'utf8').match(PORT_EXPRESSION);

  if (!match) {
    throw new Error(
      'Could not find the healthcheck port expression in the Dockerfile. If the HEALTHCHECK was ' +
        'rewritten, update PORT_EXPRESSION here so this stays a guard rather than a passing test.',
    );
  }

  return match[1];
}

function probePort(raw?: string): string {
  const env = raw === undefined ? {} : { HTTP_PORT: raw };
  // The expression comes from a file in this repository, not from input — evaluating it is the
  // whole point: restating it here is what would let the two drift apart unnoticed.
  // eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
  const evaluate = new Function('process', `return ${probePortExpression()};`) as (
    fake: unknown,
  ) => string | number;

  return String(evaluate({ env }));
}

describe('healthcheck port', () => {
  it('should be readable out of the Dockerfile', () => {
    expect(probePortExpression()).toContain('HTTP_PORT');
  });

  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['whitespace only', '   '],
    ['a plain port', '8080'],
    ['a padded port', ' 8080 '],
    ['the default spelled out', '3450'],
    ['zero', '0'],
  ])('should agree with the server on %s', (_label, raw) => {
    const env = (raw === undefined ? {} : { HTTP_PORT: raw }) as NodeJS.ProcessEnv;

    expect(probePort(raw)).toBe(String(parseConfig(env).httpPort));
  });
});
