/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Covers the optional-dependency failure path: when @forestadmin/workflow-executor is not
 * installed, the dynamic import() rejects and the agent surfaces an actionable error.
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

// Simulate the package being absent: importing it throws, like a MODULE_NOT_FOUND at runtime.
jest.mock('@forestadmin/workflow-executor', () => {
  throw new Error("Cannot find module '@forestadmin/workflow-executor'");
});

beforeEach(() => {
  jest.clearAllMocks();
  mockMakeRoutes.mockReturnValue([{ setupRoutes: jest.fn(), bootstrap: jest.fn() }]);
  jest
    .mocked(DataSourceCustomizer.prototype.getDataSource)
    .mockResolvedValue(factories.dataSource.build());
});

describe('Agent.addWorkflowExecutor (optional dependency missing)', () => {
  test('throws an actionable error when @forestadmin/workflow-executor cannot be imported', async () => {
    const agent = new Agent(
      factories.forestAdminHttpDriverOptions.build({ skipSchemaUpdate: true }),
    );
    agent.addWorkflowExecutor({
      agentUrl: 'http://my-agent',
      database: { uri: 'postgres://localhost/db' },
    });

    await expect(agent.start()).rejects.toThrow(
      'The embedded workflow executor requires the `@forestadmin/workflow-executor` package',
    );
  });
});
