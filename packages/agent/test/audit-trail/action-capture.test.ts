import type { ActionResult, Caller } from '@forestadmin/datasource-toolkit';

import captureAction from '../../src/audit-trail/action-capture';
import { REDACTED } from '../../src/audit-trail/instrument';

const caller: Caller = { id: 42, requestId: 'req-1' } as unknown as Caller;

describe('captureAction', () => {
  test('records one entry per targeted record with a shared correlation key', async () => {
    const sink = jest.fn();
    const result: ActionResult = { type: 'Success', message: 'ok', invalidated: new Set() };

    await captureAction(sink, [], {
      caller,
      collection: 'books',
      formValues: { title: 'Dune' },
      result,
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
        previousValues: { title: 'Dune' },
        newValues: { type: 'Success', message: 'ok' },
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

  test('records action_failed with empty newValues when the invocation threw', async () => {
    const sink = jest.fn();

    await captureAction(sink, [], {
      caller,
      collection: 'books',
      formValues: {},
      recordIds: ['1'],
      failed: true,
    });

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'action_failed', newValues: {} }),
    );
  });

  test('records action_failed with the error summary when the action resolved an Error result', async () => {
    const sink = jest.fn();
    const result: ActionResult = { type: 'Error', message: 'insufficient funds' };

    await captureAction(sink, [], {
      caller,
      collection: 'books',
      formValues: {},
      result,
      recordIds: ['1'],
      failed: true,
    });

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'action_failed',
        newValues: { type: 'Error', message: 'insufficient funds' },
      }),
    );
  });

  test('redacts the listed submitted-form fields, but not the result', async () => {
    const sink = jest.fn();
    const result: ActionResult = {
      type: 'Success',
      message: 'ssn 123-45-6789 accepted',
      invalidated: new Set(),
    };

    await captureAction(sink, ['ssn'], {
      caller,
      collection: 'books',
      formValues: { title: 'Dune', ssn: '123-45-6789' },
      result,
      recordIds: ['1'],
    });

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        previousValues: { title: 'Dune', ssn: REDACTED },
        newValues: { type: 'Success', message: 'ssn 123-45-6789 accepted' },
      }),
    );
  });

  describe('result summary', () => {
    const capture = async (result: ActionResult) => {
      const sink = jest.fn();
      await captureAction(sink, [], {
        caller,
        collection: 'books',
        formValues: {},
        result,
        recordIds: ['1'],
      });

      return sink.mock.calls[0][0].newValues;
    };

    test('drops html and invalidated from a Success result', async () => {
      const newValues = await capture({
        type: 'Success',
        message: 'ok',
        html: '<p>ok</p>',
        invalidated: new Set(['books']),
      });

      expect(newValues).toEqual({ type: 'Success', message: 'ok' });
    });

    test('drops html from an Error result', async () => {
      const newValues = await capture({ type: 'Error', message: 'nope', html: '<p>nope</p>' });

      expect(newValues).toEqual({ type: 'Error', message: 'nope' });
    });

    test('keeps method/url but drops headers and body from a Webhook result', async () => {
      const newValues = await capture({
        type: 'Webhook',
        url: 'https://example.com/hook',
        method: 'POST',
        headers: { Authorization: 'Bearer secret' },
        body: { amount: 10 },
      });

      expect(newValues).toEqual({
        type: 'Webhook',
        url: 'https://example.com/hook',
        method: 'POST',
      });
    });

    test('keeps name/mimeType but drops the stream from a File result', async () => {
      const newValues = await capture({
        type: 'File',
        name: 'export.csv',
        mimeType: 'text/csv',
        stream: 'not-a-real-stream' as never,
      });

      expect(newValues).toEqual({ type: 'File', name: 'export.csv', mimeType: 'text/csv' });
    });

    test('keeps path from a Redirect result', async () => {
      const newValues = await capture({ type: 'Redirect', path: '/somewhere' });

      expect(newValues).toEqual({ type: 'Redirect', path: '/somewhere' });
    });

    test('drops top-level responseHeaders regardless of result type', async () => {
      const newValues = await capture({
        type: 'Success',
        message: 'ok',
        invalidated: new Set(),
        responseHeaders: { 'x-custom': 'value' },
      });

      expect(newValues).toEqual({ type: 'Success', message: 'ok' });
    });
  });
});
