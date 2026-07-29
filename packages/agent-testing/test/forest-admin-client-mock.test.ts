import ForestAdminClientMock from '../src/forest-admin-client-mock';

describe('ForestAdminClientMock', () => {
  describe('workflowsService', () => {
    it('should resolve an empty list of MCP-enabled workflows', async () => {
      const client = new ForestAdminClientMock();

      await expect(
        client.workflowsService.listMcpEnabledWorkflows({
          forestServerToken: 'token',
          renderingId: '1',
        }),
      ).resolves.toEqual([]);
    });

    it('should resolve a loading run when triggering a workflow', async () => {
      const client = new ForestAdminClientMock();

      await expect(
        client.workflowsService.triggerMcpWorkflow({
          forestServerToken: 'token',
          renderingId: '1',
          workflowId: 'wf-1',
          recordId: '42',
        }),
      ).resolves.toEqual({ runId: 1, runState: 'loading' });
    });

    it('should resolve a loading run status when fetching a workflow run', async () => {
      const client = new ForestAdminClientMock();

      await expect(
        client.workflowsService.getMcpWorkflowRun({
          forestServerToken: 'token',
          renderingId: '1',
          runId: '1',
        }),
      ).resolves.toEqual({
        runState: 'loading',
        currentStep: null,
        waitingForHumanInput: false,
      });
    });
  });
});
