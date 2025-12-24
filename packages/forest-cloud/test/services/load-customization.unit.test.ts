import type { Agent } from '../../src/types';

import path from 'path';

import { CustomizationError } from '../../src/errors';
import loadCustomization from '../../src/services/load-customization';

describe('loadCustomization', () => {
  function setupAgent() {
    return {
      addChart: jest.fn(),
    } as unknown as Agent;
  }

  describe('when the customization file exports a function with module.exports', () => {
    it('should customize the agent', () => {
      const agent = setupAgent();
      const buildCodePath = path.resolve(
        __dirname,
        './__data__/customization/exports/dist/code-customizations',
      );

      loadCustomization(agent, buildCodePath);

      expect(agent.addChart).toHaveBeenCalledWith('test-exports', expect.any(Function));
    });

    describe('when the module does not export a function', () => {
      it('should throw a customization error', () => {
        const agent = setupAgent();
        const buildCodePath = path.resolve(
          __dirname,
          './__data__/customization/not-a-function/dist/code-customizations',
        );

        expect(() => loadCustomization(agent, buildCodePath)).toThrow(
          new CustomizationError('Customization file must export a function'),
        );
      });
    });

    describe('when the module contains a package.json and the entry point is not index.js', () => {
      it('should customize the agent', () => {
        const agent = setupAgent();
        const buildCodePath = path.resolve(
          __dirname,
          './__data__/customization/package/dist/code-customizations',
        );

        loadCustomization(agent, buildCodePath);

        expect(agent.addChart).toHaveBeenCalledWith('test-package', expect.any(Function));
      });
    });
  });

  describe('when the customization file exports a function with export default', () => {
    it('should customize the agent', () => {
      const agent = setupAgent();
      const buildCodePath = path.resolve(
        __dirname,
        './__data__/customization/default/dist/code-customizations',
      );

      loadCustomization(agent, buildCodePath);

      expect(agent.addChart).toHaveBeenCalledWith('test-default', expect.any(Function));
    });

    describe('when the customization throws an error', () => {
      it('should throw a customization error', () => {
        const agent = setupAgent();
        const buildCodePath = path.resolve(
          __dirname,
          './__data__/customization/error/dist/code-customizations',
        );

        expect(() => loadCustomization(agent, buildCodePath)).toThrow(
          new CustomizationError('Issue with customizations: Error\nSome error occurred'),
        );
      });
    });
  });
});
