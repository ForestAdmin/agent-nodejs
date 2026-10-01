import type { SegmentReadFailureKind } from '../../src/errors';

import { mayBeOperatorRefusal, toReadFailure } from '../../src/automation/read-failure';
import {
  CompositeRecordIdMismatchError,
  SegmentReadError,
  SegmentRecordIdMissingError,
} from '../../src/errors';

function readError(failure: SegmentReadFailureKind, httpStatus?: number): SegmentReadError {
  return new SegmentReadError('listSegmentRecordIds', new Error('read failed'), {
    failure,
    httpStatus,
  });
}

describe('toReadFailure', () => {
  it.each(
    [
      [
        'forbidden with a 403',
        readError('forbidden', 403),
        { reason: 'agent-forbidden', httpStatus: 403 },
      ],
      [
        'forbidden with a 401',
        readError('forbidden', 401),
        { reason: 'agent-forbidden', httpStatus: 401 },
      ],
      ['forbidden without a status', readError('forbidden'), { reason: 'agent-forbidden' }],
      [
        'unreachable with a 503',
        readError('unreachable', 503),
        { reason: 'agent-unreachable', httpStatus: 503 },
      ],
      ['unreachable without a status', readError('unreachable'), { reason: 'agent-unreachable' }],
      [
        'overloaded with a 429',
        readError('overloaded', 429),
        { reason: 'segment-read-failed', httpStatus: 429 },
      ],
      ['overloaded without a status', readError('overloaded'), { reason: 'segment-read-failed' }],
      [
        'failed with a 500',
        readError('failed', 500),
        { reason: 'segment-read-failed', httpStatus: 500 },
      ],
      [
        'failed with a 400',
        readError('failed', 400),
        { reason: 'segment-read-failed', httpStatus: 400 },
      ],
      ['failed without a status', readError('failed'), { reason: 'segment-read-failed' }],
      ['an error that is no segment read', new Error('boom'), { reason: 'segment-read-failed' }],
      [
        'a record id it cannot split',
        new CompositeRecordIdMismatchError('1', 2),
        { reason: 'segment-read-failed' },
      ],
      [
        'a record without an id',
        new SegmentRecordIdMissingError('orders'),
        { reason: 'segment-read-failed' },
      ],
    ].map(([label, error, expected]) => [label, expected, error]),
  )('should report a read %s as %j', (_, expected, error) => {
    expect(toReadFailure(error)).toStrictEqual(expected);
  });
});

describe('mayBeOperatorRefusal', () => {
  it.each(
    [
      ['a forbidden read', readError('forbidden', 403), false],
      ['an unreachable agent', readError('unreachable'), false],
      ['an unreachable agent answering 503', readError('unreachable', 503), false],
      ['an overloaded agent', readError('overloaded', 429), false],
      ['a failed read answering 400', readError('failed', 400), true],
      ['a failed read answering 500', readError('failed', 500), true],
      ['an error that is no segment read', new Error('boom'), true],
    ].map(([label, error, expected]) => [label, expected, error]),
  )('should judge %s as a possible operator refusal: %s', (_, expected, error) => {
    expect(mayBeOperatorRefusal(error)).toBe(expected);
  });
});
