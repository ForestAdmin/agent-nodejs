import type { InboxAssignment } from '../../src/types/automation';

import {
  chunk,
  isReadableRecordId,
  knownRecordIds,
  newCandidates,
  paddedPageSize,
  reconcilable,
  recordsToCheck,
  withUnexpectedRunState,
  withUnknownState,
} from '../../src/automation/reconciliation';

const ASSIGNMENT_STATES = ['done', 'canceled', 'auto-canceled', 'todo', 'doing', 'escalated'];

const RUN_STATES = ['finished', 'aborted', 'started', 'pending', 'loading', null, 'paused'];

const RECONCILED_RUN_STATES: Record<string, (string | null)[]> = {
  done: RUN_STATES,
  canceled: RUN_STATES,
  'auto-canceled': RUN_STATES,
  todo: [],
  doing: ['finished', 'aborted'],
  escalated: [],
};

const UNKNOWN_ASSIGNMENT_STATES = ['escalated'];

const UNEXPECTED_RUN_STATES = [null, 'paused'];

const CASES = ASSIGNMENT_STATES.flatMap(state =>
  RUN_STATES.flatMap(runState =>
    [7, null].map(workflowRunId => ({ state, runState, workflowRunId })),
  ),
);

function assignment(overrides: Partial<InboxAssignment> = {}): InboxAssignment {
  return { recordId: 'r1', state: 'done', workflowRunId: 1, runState: 'finished', ...overrides };
}

describe('reconcilable', () => {
  it.each(CASES)(
    'should judge an assignment in state $state with run state $runState and run $workflowRunId',
    ({ state, runState, workflowRunId }) => {
      const subject = assignment({ state, runState, workflowRunId });
      const expected = workflowRunId !== null && RECONCILED_RUN_STATES[state].includes(runState);

      expect(reconcilable([subject])).toStrictEqual(expected ? [subject] : []);
    },
  );

  it('should keep the reconcilable assignments in their order', () => {
    const first = assignment({ recordId: 'a', state: 'canceled' });
    const open = assignment({ recordId: 'b', state: 'todo' });
    const second = assignment({ recordId: 'c', state: 'doing', runState: 'aborted' });

    expect(reconcilable([first, open, second])).toStrictEqual([first, second]);
  });
});

describe('withUnknownState', () => {
  it.each(CASES)(
    'should judge an assignment in state $state with run state $runState and run $workflowRunId',
    ({ state, runState, workflowRunId }) => {
      const subject = assignment({ state, runState, workflowRunId });
      const expected = UNKNOWN_ASSIGNMENT_STATES.includes(state);

      expect(withUnknownState([subject])).toStrictEqual(expected ? [subject] : []);
    },
  );
});

describe('withUnexpectedRunState', () => {
  it.each(CASES)(
    'should judge an assignment in state $state with run state $runState and run $workflowRunId',
    ({ state, runState, workflowRunId }) => {
      const subject = assignment({ state, runState, workflowRunId });
      const expected = UNEXPECTED_RUN_STATES.includes(runState);

      expect(withUnexpectedRunState([subject])).toStrictEqual(expected ? [subject] : []);
    },
  );

  it('should treat an absent run state as unexpected', () => {
    const subject = assignment({ runState: undefined });

    expect(withUnexpectedRunState([subject])).toStrictEqual([subject]);
  });
});

describe('recordsToCheck', () => {
  it('should leave out a record holding a terminal and a live assignment', () => {
    const ended = assignment({ recordId: 'r1', state: 'done', runState: 'finished' });
    const live = assignment({ recordId: 'r1', state: 'doing', runState: 'started' });
    const other = assignment({ recordId: 'r2', state: 'canceled', runState: 'aborted' });

    expect(recordsToCheck([ended, live, other], [ended, other])).toStrictEqual(['r2']);
  });

  it('should leave out a record whose run state is not terminal', () => {
    const unplaced = assignment({ recordId: 'r1', state: 'done', runState: null });

    expect(recordsToCheck([unplaced], [unplaced])).toStrictEqual([]);
  });

  it('should name each record once, in the order it is first seen', () => {
    const assignments = [
      assignment({ recordId: 'r2', state: 'done' }),
      assignment({ recordId: 'r1', state: 'canceled', runState: 'aborted' }),
      assignment({ recordId: 'r2', state: 'auto-canceled' }),
    ];

    expect(recordsToCheck(assignments, assignments)).toStrictEqual(['r2', 'r1']);
  });

  it('should only name records among the reconcilable assignments', () => {
    const reconciled = assignment({ recordId: 'r1' });
    const notReconciled = assignment({ recordId: 'r2' });

    expect(recordsToCheck([reconciled, notReconciled], [reconciled])).toStrictEqual(['r1']);
  });
});

describe('isReadableRecordId', () => {
  it.each([
    ['a plain id on a single key', '12', ['id'], true],
    ['an id holding the separator on a single key', 'a|b', ['id'], true],
    ['a packed id with as many parts as the key', 't1|5', ['tenant', 'id'], true],
    ['a packed id with too many parts', 't1|a|5', ['tenant', 'id'], false],
    ['a packed id with too few parts', '5', ['tenant', 'id'], false],
  ])('should judge %s', (_, recordId, primaryKeys, expected) => {
    expect(isReadableRecordId(recordId, primaryKeys)).toBe(expected);
  });
});

describe('knownRecordIds', () => {
  it('should name each record once, in the order it is first seen', () => {
    expect(
      knownRecordIds([
        assignment({ recordId: 'b' }),
        assignment({ recordId: 'a' }),
        assignment({ recordId: 'b', state: 'doing' }),
      ]),
    ).toStrictEqual(['b', 'a']);
  });

  it('should know no record without assignments', () => {
    expect(knownRecordIds([])).toStrictEqual([]);
  });
});

describe('paddedPageSize', () => {
  it.each([
    [20, 0, 20],
    [20, 479, 499],
    [20, 480, 500],
    [20, 481, 500],
    [600, 0, 500],
  ])(
    'should ask %i runs over %i assignments as a page of %i',
    (maxConcurrentRuns, count, expected) => {
      expect(paddedPageSize(maxConcurrentRuns, count)).toBe(expected);
    },
  );
});

describe('newCandidates', () => {
  const page = ['known', 'n1', 'found', 'n2', 'n3'];
  const known = new Set(['known']);
  const found = new Set(['found']);

  it.each([
    [0, []],
    [2, ['n1', 'n2']],
    [3, ['n1', 'n2', 'n3']],
    [10, ['n1', 'n2', 'n3']],
  ])('should keep at most %i new records, in page order', (room, expected) => {
    expect(newCandidates(page, known, found, room)).toStrictEqual(expected);
  });
});

describe('chunk', () => {
  it.each([
    [
      'an exact multiple',
      [1, 2, 3, 4],
      2,
      [
        [1, 2],
        [3, 4],
      ],
    ],
    ['a remainder', [1, 2, 3, 4, 5], 2, [[1, 2], [3, 4], [5]]],
    ['fewer items than a chunk', [1, 2, 3], 50, [[1, 2, 3]]],
    ['no items', [], 2, []],
  ])('should split %s', (_, items, size, expected) => {
    expect(chunk(items, size)).toStrictEqual(expected);
  });
});
