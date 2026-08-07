import { createMockContext } from '@shopify/jest-koa-mocks';

import {
  CORRELATION_ID_HEADER,
  correlationIdMiddleware,
  getRequestId,
} from '../../src/utils/correlation-id';

describe('correlation-id', () => {
  describe('getRequestId', () => {
    test('generates a requestId and memoizes it on the context state', () => {
      const context = createMockContext({});

      const first = getRequestId(context);
      const second = getRequestId(context);

      expect(first).toEqual(expect.any(String));
      expect(second).toBe(first);
      expect(context.state.requestId).toBe(first);
    });

    test('generates distinct ids for distinct contexts', () => {
      expect(getRequestId(createMockContext({}))).not.toBe(getRequestId(createMockContext({})));
    });
  });

  describe('correlationIdMiddleware', () => {
    test('echoes the requestId in the response header when one was generated', async () => {
      const context = createMockContext({});
      const next = jest.fn().mockImplementation(async () => {
        getRequestId(context);
      });
      const setHeader = jest.spyOn(context.response, 'set');

      await correlationIdMiddleware(context, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, context.state.requestId);
    });

    test('runs the downstream handler before setting the header', async () => {
      const order: string[] = [];
      const context = createMockContext({});
      jest
        .spyOn(context.response, 'set')
        .mockImplementation(() => order.push('set-header') as never);
      const next = jest.fn().mockImplementation(async () => {
        getRequestId(context);
        order.push('handler');
      });

      await correlationIdMiddleware(context, next);

      expect(order).toEqual(['handler', 'set-header']);
    });

    test('does not set the header when no requestId was generated', async () => {
      const context = createMockContext({});
      const setHeader = jest.spyOn(context.response, 'set');

      await correlationIdMiddleware(context, jest.fn());

      expect(setHeader).not.toHaveBeenCalledWith(CORRELATION_ID_HEADER, expect.anything());
    });
  });
});
