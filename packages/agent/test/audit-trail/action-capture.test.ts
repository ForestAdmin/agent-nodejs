import type { Caller } from '@forestadmin/datasource-toolkit';

import captureAction from '../../src/audit-trail/action-capture';
import { REDACTED } from '../../src/audit-trail/instrument';

const caller: Caller = { id: 42, requestId: 'req-1' } as unknown as Caller;

describe('captureAction', () => {
  test('records one entry per targeted record with a shared correlation key', async () => {
    const sink = jest.fn();

    await captureAction(sink, [], {
      caller,
      collection: 'books',
      formValues: { title: 'Dune' },
      recordIds: ['1', '2'],
    });

    expect(sink).toHaveBeenCalledTimes(2);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'action',
        collection: 'books',
        recordId: '1',
        userId: 42,
        correlationKey: 'req-1',
        previousValues: {},
        newValues: { title: 'Dune' },
      }),
    );
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ recordId: '2' }));
  });

  test('records one entry attached to no record when no id is given', async () => {
    const sink = jest.fn();

    await captureAction(sink, [], {
      caller,
      collection: 'books',
      formValues: {},
      recordIds: [],
    });

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ recordId: '' }));
  });

  test('records action_failed when the invocation failed', async () => {
    const sink = jest.fn();

    await captureAction(sink, [], {
      caller,
      collection: 'books',
      formValues: {},
      recordIds: ['1'],
      failed: true,
    });

    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ operation: 'action_failed' }));
  });

  test('redacts the listed form fields', async () => {
    const sink = jest.fn();

    await captureAction(sink, ['ssn'], {
      caller,
      collection: 'books',
      formValues: { title: 'Dune', ssn: '123-45-6789' },
      recordIds: ['1'],
    });

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ newValues: { title: 'Dune', ssn: REDACTED } }),
    );
  });
});
