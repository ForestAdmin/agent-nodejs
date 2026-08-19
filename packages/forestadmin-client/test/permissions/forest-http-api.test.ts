import ForestHttpApi from '../../src/permissions/forest-http-api';
import ServerUtils from '../../src/utils/server';
import * as factories from '../__factories__';

jest.mock('../../src/utils/server', () => ({
  query: jest.fn(),
  queryWithBearerToken: jest.fn(),
}));

describe('ForestHttpApi', () => {
  const options = factories.forestAdminClientOptions.build();

  test('getEnvironmentPermissions should call the right endpoint', async () => {
    await new ForestHttpApi().getEnvironmentPermissions(options);

    expect(ServerUtils.query).toHaveBeenCalledWith(
      options,
      'get',
      '/liana/v4/permissions/environment',
    );
  });

  test('getUsers should call the right endpoint', async () => {
    await new ForestHttpApi().getUsers(options);

    expect(ServerUtils.query).toHaveBeenCalledWith(options, 'get', '/liana/v4/permissions/users');
  });

  test('getRenderingPermissions should call the right endpoint', async () => {
    await new ForestHttpApi().getRenderingPermissions(42, options);

    expect(ServerUtils.query).toHaveBeenCalledWith(
      options,
      'get',
      '/liana/v4/permissions/renderings/42',
    );
  });

  describe('getModelCustomizations', () => {
    it('should call the right endpoint', async () => {
      await new ForestHttpApi().getModelCustomizations(options);

      expect(ServerUtils.query).toHaveBeenCalledWith(options, 'get', '/liana/model-customizations');
    });
  });

  describe('getMcpServerConfigs', () => {
    it('should call the right endpoint', async () => {
      await new ForestHttpApi().getMcpServerConfigs(options);

      expect(ServerUtils.query).toHaveBeenCalledWith(
        options,
        'get',
        '/liana/mcp-server-configs-with-details',
      );
    });
  });

  describe('getIpWhitelistRules', () => {
    it('should call the right endpoint', async () => {
      const mockResponse = {
        data: { attributes: { use_ip_whitelist: true, rules: [] } },
      };
      (ServerUtils.query as jest.Mock).mockResolvedValue(mockResponse);

      const result = await new ForestHttpApi().getIpWhitelistRules(options);

      expect(ServerUtils.query).toHaveBeenCalledWith(
        options,
        'get',
        '/liana/v1/ip-whitelist-rules',
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getSchema', () => {
    it('should call the right endpoint and deserialize response', async () => {
      const mockResponse = {
        data: [{ id: 'users', type: 'collections', attributes: { name: 'users' } }],
        included: [],
      };
      (ServerUtils.query as jest.Mock).mockResolvedValue(mockResponse);

      const result = await new ForestHttpApi().getSchema(options);

      expect(ServerUtils.query).toHaveBeenCalledWith(options, 'get', '/liana/forest-schema');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('users');
    });
  });

  describe('postSchema', () => {
    it('should call the right endpoint with schema and a 30s timeout', async () => {
      const schema = { data: [], meta: { schemaFileHash: 'abc123' } };

      await new ForestHttpApi().postSchema(options, schema);

      expect(ServerUtils.query).toHaveBeenCalledWith(
        options,
        'post',
        '/forest/apimaps',
        {},
        schema,
        30_000,
      );
    });
  });

  describe('checkSchemaHash', () => {
    it('should call the right endpoint with hash', async () => {
      (ServerUtils.query as jest.Mock).mockResolvedValue({ sendSchema: true });

      const result = await new ForestHttpApi().checkSchemaHash(options, 'abc123');

      expect(ServerUtils.query).toHaveBeenCalledWith(
        options,
        'post',
        '/forest/apimaps/hashcheck',
        {},
        { schemaFileHash: 'abc123' },
      );
      expect(result).toEqual({ sendSchema: true });
    });
  });

  describe('createActivityLog', () => {
    it('should call the right endpoint with body', async () => {
      const mockActivityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
      (ServerUtils.queryWithBearerToken as jest.Mock).mockResolvedValue({ data: mockActivityLog });

      const body = { data: { id: 1, type: 'activity-logs-requests' } };
      const activityLogOptions = {
        forestServerUrl: options.forestServerUrl,
        bearerToken: 'bearer-token',
        headers: { 'Custom-Header': 'value' },
      };
      const result = await new ForestHttpApi().createActivityLog(activityLogOptions, body);

      expect(ServerUtils.queryWithBearerToken).toHaveBeenCalledWith({
        forestServerUrl: options.forestServerUrl,
        method: 'post',
        path: '/api/activity-logs-requests',
        bearerToken: 'bearer-token',
        body,
        headers: { 'Custom-Header': 'value' },
      });
      expect(result).toEqual(mockActivityLog);
    });
  });

  describe('createMcpActivityLog', () => {
    it('should call the mcp endpoint with body', async () => {
      const mockActivityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
      (ServerUtils.queryWithBearerToken as jest.Mock).mockResolvedValue({ data: mockActivityLog });

      const body = {
        type: 'read',
        action: 'index',
        status: 'pending',
        records: [],
        renderingId: '12345',
        collectionModelName: 'users',
      };
      const activityLogOptions = {
        forestServerUrl: options.forestServerUrl,
        bearerToken: 'bearer-token',
        headers: { 'Custom-Header': 'value' },
      };
      const result = await new ForestHttpApi().createMcpActivityLog(activityLogOptions, body);

      expect(ServerUtils.queryWithBearerToken).toHaveBeenCalledWith({
        forestServerUrl: options.forestServerUrl,
        method: 'post',
        path: '/api/activity-logs-requests/mcp',
        bearerToken: 'bearer-token',
        body,
        headers: { 'Forest-Application-Source': 'MCP', 'Custom-Header': 'value' },
      });
      expect(result).toEqual(mockActivityLog);
    });
  });

  describe('updateActivityLogStatus', () => {
    it('should call the right endpoint with status', async () => {
      const body = { status: 'completed' };
      const activityLogOptions = {
        forestServerUrl: options.forestServerUrl,
        bearerToken: 'bearer-token',
      };

      await new ForestHttpApi().updateActivityLogStatus(
        activityLogOptions,
        'idx-456',
        'log-123',
        body,
      );

      expect(ServerUtils.queryWithBearerToken).toHaveBeenCalledWith({
        forestServerUrl: options.forestServerUrl,
        method: 'patch',
        path: '/api/activity-logs-requests/idx-456/log-123/status',
        bearerToken: 'bearer-token',
        body,
        headers: undefined,
      });
    });
  });

  describe('listMcpEnabledWorkflows', () => {
    it('should GET the workflows endpoint with the rendering id header', async () => {
      const workflows = [{ workflowId: 'wf-1', name: 'Refund order', collectionName: 'orders' }];
      (ServerUtils.queryWithBearerToken as jest.Mock).mockResolvedValue(workflows);

      const result = await new ForestHttpApi().listMcpEnabledWorkflows(
        { forestServerUrl: options.forestServerUrl, bearerToken: 'bearer-token' },
        '12345',
      );

      expect(ServerUtils.queryWithBearerToken).toHaveBeenCalledWith({
        forestServerUrl: options.forestServerUrl,
        method: 'get',
        path: '/api/workflow-orchestrator/mcp-workflows',
        bearerToken: 'bearer-token',
        headers: {
          'forest-rendering-id': '12345',
          'Forest-Application-Source': 'MCP',
        },
      });
      expect(result).toEqual(workflows);
    });

    it('should strip fields the contract does not declare from each listed workflow', async () => {
      (ServerUtils.queryWithBearerToken as jest.Mock).mockResolvedValue([
        {
          workflowId: 'wf-1',
          name: 'Refund order',
          collectionName: 'orders',
          // A column added to the server query must not reach the model's prompt on its own.
          createdByEmail: 'ops@example.com',
          bpmnAwsS3Identifier: 'internal/path.bpmn',
        },
      ]);

      const result = await new ForestHttpApi().listMcpEnabledWorkflows(
        { forestServerUrl: options.forestServerUrl, bearerToken: 'bearer-token' },
        '12345',
      );

      expect(result).toEqual([
        { workflowId: 'wf-1', name: 'Refund order', collectionName: 'orders' },
      ]);
      expect(JSON.stringify(result)).not.toContain('ops@example.com');
      expect(JSON.stringify(result)).not.toContain('internal/path.bpmn');
    });

    it('should return an empty array when the server answers with no body', async () => {
      (ServerUtils.queryWithBearerToken as jest.Mock).mockResolvedValue(undefined);

      const result = await new ForestHttpApi().listMcpEnabledWorkflows(
        { forestServerUrl: options.forestServerUrl, bearerToken: 'bearer-token' },
        '12345',
      );

      expect(result).toEqual([]);
    });

    it('should append the collectionName filter as a url-encoded query param', async () => {
      (ServerUtils.queryWithBearerToken as jest.Mock).mockResolvedValue([]);

      await new ForestHttpApi().listMcpEnabledWorkflows(
        { forestServerUrl: options.forestServerUrl, bearerToken: 'bearer-token' },
        '12345',
        'sales orders',
      );

      expect(ServerUtils.queryWithBearerToken).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'get',
          path: '/api/workflow-orchestrator/mcp-workflows?collectionName=sales%20orders',
          headers: {
            'forest-rendering-id': '12345',
            'Forest-Application-Source': 'MCP',
          },
        }),
      );
    });
  });

  describe('getMcpWorkflowById', () => {
    it('should GET the by-id workflow endpoint with the rendering id header', async () => {
      const workflow = {
        workflowId: 'wf-1',
        name: 'Refund order',
        collectionName: 'orders',
        mcpEnabled: true,
      };
      (ServerUtils.queryWithBearerToken as jest.Mock).mockResolvedValue(workflow);

      const result = await new ForestHttpApi().getMcpWorkflowById(
        { forestServerUrl: options.forestServerUrl, bearerToken: 'bearer-token' },
        '12345',
        'wf-1',
      );

      expect(ServerUtils.queryWithBearerToken).toHaveBeenCalledWith({
        forestServerUrl: options.forestServerUrl,
        method: 'get',
        path: '/api/workflow-orchestrator/mcp-workflows/wf-1',
        bearerToken: 'bearer-token',
        headers: {
          'forest-rendering-id': '12345',
          'Forest-Application-Source': 'MCP',
        },
      });
      expect(result).toEqual(workflow);
    });

    it('should url-encode the workflow id in the path', async () => {
      (ServerUtils.queryWithBearerToken as jest.Mock).mockResolvedValue({
        workflowId: 'wf/with space',
        name: 'Refund order',
        collectionName: null,
        mcpEnabled: false,
      });

      await new ForestHttpApi().getMcpWorkflowById(
        { forestServerUrl: options.forestServerUrl, bearerToken: 'bearer-token' },
        '12345',
        'wf/with space',
      );

      expect(ServerUtils.queryWithBearerToken).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'get',
          path: '/api/workflow-orchestrator/mcp-workflows/wf%2Fwith%20space',
        }),
      );
    });
  });

  describe('triggerMcpWorkflow', () => {
    it('should POST the record id to the workflow start endpoint with the rendering id header', async () => {
      (ServerUtils.queryWithBearerToken as jest.Mock).mockResolvedValue({
        runId: 7,
        runState: 'loading',
      });

      const result = await new ForestHttpApi().triggerMcpWorkflow(
        { forestServerUrl: options.forestServerUrl, bearerToken: 'bearer-token' },
        '12345',
        'wf-1',
        '42',
      );

      expect(ServerUtils.queryWithBearerToken).toHaveBeenCalledWith({
        forestServerUrl: options.forestServerUrl,
        method: 'post',
        path: '/api/workflow-orchestrator/mcp-workflows/wf-1/start',
        bearerToken: 'bearer-token',
        body: { recordId: '42' },
        headers: {
          'forest-rendering-id': '12345',
          'Forest-Application-Source': 'MCP',
        },
      });
      expect(result).toEqual({ runId: '7', runState: 'loading' });
    });

    it('should normalize a numeric runId returned by the server to a string', async () => {
      (ServerUtils.queryWithBearerToken as jest.Mock).mockResolvedValue({
        runId: 7,
        runState: 'loading',
      });

      const result = await new ForestHttpApi().triggerMcpWorkflow(
        { forestServerUrl: options.forestServerUrl, bearerToken: 'bearer-token' },
        '12345',
        'wf-1',
        '42',
      );

      expect(result.runId).toBe('7');
    });

    it('should url-encode the workflow id in the path', async () => {
      (ServerUtils.queryWithBearerToken as jest.Mock).mockResolvedValue({
        runId: 1,
        runState: 'loading',
      });

      await new ForestHttpApi().triggerMcpWorkflow(
        { forestServerUrl: options.forestServerUrl, bearerToken: 'bearer-token' },
        '12345',
        'wf/with space',
        '42',
      );

      expect(ServerUtils.queryWithBearerToken).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
          path: '/api/workflow-orchestrator/mcp-workflows/wf%2Fwith%20space/start',
        }),
      );
    });
  });

  describe('getMcpWorkflowRun', () => {
    it('should GET the workflow run endpoint with the rendering id header', async () => {
      const runStatus = {
        id: 7,
        userId: 42,
        renderingId: 12345,
        collectionId: 'orders',
        workflowId: 'wf-1',
        bpmnVersion: '3',
        selectedRecordId: '99',
        runState: 'finished',
        engine: 'orchestrator',
        triggerType: 'mcp',
        lockedAt: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:05:00.000Z',
        workflowHistory: [],
      };
      (ServerUtils.queryWithBearerToken as jest.Mock).mockResolvedValue(runStatus);

      const result = await new ForestHttpApi().getMcpWorkflowRun(
        { forestServerUrl: options.forestServerUrl, bearerToken: 'bearer-token' },
        '12345',
        '7',
      );

      expect(ServerUtils.queryWithBearerToken).toHaveBeenCalledWith({
        forestServerUrl: options.forestServerUrl,
        method: 'get',
        path: '/api/workflow-orchestrator/mcp-workflows/runs/7',
        bearerToken: 'bearer-token',
        headers: {
          'forest-rendering-id': '12345',
          'Forest-Application-Source': 'MCP',
        },
      });
      expect(result).toEqual(runStatus);
    });

    it('should strip fields the contract does not declare, including a leaked serverToken', async () => {
      (ServerUtils.queryWithBearerToken as jest.Mock).mockResolvedValue({
        id: 7,
        runState: 'started',
        workflowHistory: [
          { stepName: 'Review', stepIndex: 0, done: false, stepDefinition: { type: 'task' } },
        ],
        // What the executor-facing build of the same run carries.
        collectionName: 'orders',
        userProfile: { email: 'ops@example.com', serverToken: 'super-secret-forest-token' },
      });

      const result = await new ForestHttpApi().getMcpWorkflowRun(
        { forestServerUrl: options.forestServerUrl, bearerToken: 'bearer-token' },
        '12345',
        '7',
      );

      expect(result).not.toHaveProperty('userProfile');
      expect(result).not.toHaveProperty('collectionName');
      expect(JSON.stringify(result)).not.toContain('super-secret-forest-token');
      expect(result.id).toBe(7);
      expect(result.runState).toBe('started');
    });

    it('should strip fields the contract does not declare from a per-step context', async () => {
      (ServerUtils.queryWithBearerToken as jest.Mock).mockResolvedValue({
        runState: 'started',
        workflowHistory: [
          {
            stepName: 'Approve',
            stepIndex: 0,
            done: false,
            stepDefinition: { type: 'escalation' },
            context: {
              escalationState: 'escalated',
              error: 'record 42 not found',
              // The step context is a closed interface here but an open bag server-side.
              completedByUser: { email: 'ops@example.com', serverToken: 'leaked-token' },
            },
          },
        ],
      });

      const result = await new ForestHttpApi().getMcpWorkflowRun(
        { forestServerUrl: options.forestServerUrl, bearerToken: 'bearer-token' },
        '12345',
        '7',
      );

      expect(result.workflowHistory[0].context).not.toHaveProperty('completedByUser');
      expect(JSON.stringify(result)).not.toContain('leaked-token');
      // The declared fields the docs tell readers to diagnose with survive.
      expect(result.workflowHistory[0].context).toMatchObject({
        escalationState: 'escalated',
        error: 'record 42 not found',
      });
    });

    it('should leave a step with no context untouched', async () => {
      (ServerUtils.queryWithBearerToken as jest.Mock).mockResolvedValue({
        runState: 'started',
        workflowHistory: [
          { stepName: 'Review', stepIndex: 0, done: true, stepDefinition: { type: 'task' } },
        ],
      });

      const result = await new ForestHttpApi().getMcpWorkflowRun(
        { forestServerUrl: options.forestServerUrl, bearerToken: 'bearer-token' },
        '12345',
        '7',
      );

      expect(result.workflowHistory[0].context).toBeUndefined();
    });

    it('should keep the task-type-specific stepDefinition fields the model reasons about', async () => {
      (ServerUtils.queryWithBearerToken as jest.Mock).mockResolvedValue({
        runState: 'started',
        workflowHistory: [
          {
            stepName: 'Refund',
            stepIndex: 0,
            done: false,
            isCardStep: false,
            context: { error: 'boom' },
            stepDefinition: {
              type: 'task',
              taskType: 'update-data',
              preRecordedArgs: { fieldName: 'status', value: 'refunded' },
            },
          },
        ],
      });

      const result = await new ForestHttpApi().getMcpWorkflowRun(
        { forestServerUrl: options.forestServerUrl, bearerToken: 'bearer-token' },
        '12345',
        '7',
      );

      expect(result.workflowHistory[0]).toEqual({
        stepName: 'Refund',
        stepIndex: 0,
        originalStepIndex: undefined,
        done: false,
        revised: undefined,
        cancelled: undefined,
        childrenWorkflowId: undefined,
        isCardStep: false,
        context: { error: 'boom' },
        stepDefinition: {
          type: 'task',
          taskType: 'update-data',
          preRecordedArgs: { fieldName: 'status', value: 'refunded' },
        },
      });
    });

    it('should tolerate a run served without a workflowHistory', async () => {
      (ServerUtils.queryWithBearerToken as jest.Mock).mockResolvedValue({ runState: 'pending' });

      const result = await new ForestHttpApi().getMcpWorkflowRun(
        { forestServerUrl: options.forestServerUrl, bearerToken: 'bearer-token' },
        '12345',
        '7',
      );

      expect(result.workflowHistory).toEqual([]);
    });

    it('should url-encode the run id in the path', async () => {
      (ServerUtils.queryWithBearerToken as jest.Mock).mockResolvedValue({
        runState: 'started',
        workflowHistory: [],
      });

      await new ForestHttpApi().getMcpWorkflowRun(
        { forestServerUrl: options.forestServerUrl, bearerToken: 'bearer-token' },
        '12345',
        'run/with space',
      );

      expect(ServerUtils.queryWithBearerToken).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'get',
          path: '/api/workflow-orchestrator/mcp-workflows/runs/run%2Fwith%20space',
        }),
      );
    });
  });
});
