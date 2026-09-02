/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Covers the optional-dependency failure path: when @forestadmin/agent-bff cannot be loaded, the
 * dynamic import() rejects and the agent surfaces an actionable error that still carries the reason.
 */
import { DataSourceCustomizer } from '@forestadmin/datasource-customizer';

import * as factories from './__factories__';
import Agent from '../src/agent';

const mockMakeRoutes = jest.fn();
jest.mock('../src/routes', () => ({
  __esModule: true,
  default: (...args) => mockMakeRoutes(...args),
}));
jest.mock('@forestadmin/datasource-customizer');

jest.mock('@forestadmin/agent-bff', () => {
  throw new Error("Cannot find module '@forestadmin/agent-bff'");
});

beforeEach(() => {
  jest.clearAllMocks();
  mockMakeRoutes.mockReturnValue([{ setupRoutes: jest.fn(), bootstrap: jest.fn() }]);
  jest
    .mocked(DataSourceCustomizer.prototype.getDataSource)
    .mockResolvedValue(factories.dataSource.build());
});

describe('Agent.addBff (optional dependency missing)', () => {
  function buildAgent() {
    return new Agent(
      factories.forestAdminHttpDriverOptions.build({ skipSchemaUpdate: true }),
    ).addBff();
  }

  it('should tell the developer to install the package', async () => {
    await expect(buildAgent().start()).rejects.toThrow(
      'The embedded BFF requires the `@forestadmin/agent-bff` package',
    );
  });

  it('should keep the load failure in the message, since installing does not always fix it', async () => {
    await expect(buildAgent().start()).rejects.toThrow(
      "Cannot find module '@forestadmin/agent-bff'",
    );
  });

  it('should keep the original error as the cause', async () => {
    const error: Error & { cause?: Error } = await buildAgent()
      .start()
      .then(() => new Error('start() resolved'))
      .catch(caught => caught as Error);

    expect(error.cause).toBeInstanceOf(Error);
    expect(error.cause?.message).toBe("Cannot find module '@forestadmin/agent-bff'");
  });
});
