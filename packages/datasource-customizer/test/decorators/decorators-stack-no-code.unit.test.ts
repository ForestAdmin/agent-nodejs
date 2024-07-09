import type { DataSource } from '@forestadmin/datasource-toolkit';

import { MissingCollectionError } from '@forestadmin/datasource-toolkit';

import DecoratorsStackNoCode from '../../src/decorators/decorators-stack-no-code';

function makeMockDataSource(): jest.Mocked<DataSource> {
  return {
    schema: {
      charts: [] as string[],
    },
    collections: [],
    getCollection: jest.fn(),
    renderChart: jest.fn(),
  };
}

describe('DecoratorsStackNoCode', () => {
  describe('applyQueuedCustomizations', () => {
    describe('when ignoreMissingSchemaElementErrors  is false', () => {
      it('should throw an error when a customization fails', async () => {
        const logger = jest.fn();
        const customization = jest.fn().mockRejectedValue(new Error('Customization failed'));

        const stack = new DecoratorsStackNoCode(makeMockDataSource(), {
          ignoreMissingSchemaElementErrors: false,
        });
        stack.queueCustomization(customization);

        await expect(stack.applyQueuedCustomizations(logger)).rejects.toThrow(
          'Customization failed',
        );
      });
    });

    describe('when ignoreMissingSchemaElementErrors  is true', () => {
      it('should log an error when a customization fails with a MissingCollectionError', async () => {
        const logger = jest.fn();
        const error = new MissingCollectionError('Customization failed');
        const customization = jest.fn().mockRejectedValue(error);

        const stack = new DecoratorsStackNoCode(makeMockDataSource(), {
          ignoreMissingSchemaElementErrors: true,
        });
        stack.queueCustomization(customization);

        await stack.applyQueuedCustomizations(logger);

        expect(logger).toHaveBeenCalledWith('Warn', 'Customization failed', error);
      });

      it('should continue to apply other customizations after a MissingCollectionError', async () => {
        const logger = jest.fn();
        const error = new MissingCollectionError('Customization failed');
        const customization1 = jest.fn().mockRejectedValue(error);
        const customization2 = jest.fn();

        const stack = new DecoratorsStackNoCode(makeMockDataSource(), {
          ignoreMissingSchemaElementErrors: true,
        });
        stack.queueCustomization(customization1);
        stack.queueCustomization(customization2);

        await stack.applyQueuedCustomizations(logger);

        expect(customization1).toHaveBeenCalled();
        expect(customization2).toHaveBeenCalled();
      });

      it('should rethrow other errors', async () => {
        const logger = jest.fn();
        const error = new Error('Customization failed');
        const customization = jest.fn().mockRejectedValue(error);

        const stack = new DecoratorsStackNoCode(makeMockDataSource(), {
          ignoreMissingSchemaElementErrors: true,
        });
        stack.queueCustomization(customization);

        await expect(stack.applyQueuedCustomizations(logger)).rejects.toThrow(
          'Customization failed',
        );
      });
    });
  });
});
