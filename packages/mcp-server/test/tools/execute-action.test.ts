import type { Logger } from '../../src/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import declareExecuteActionTool from '../../src/tools/execute-action';
import { buildClientWithActions } from '../../src/utils/agent-caller';
import withActivityLog from '../../src/utils/with-activity-log';

jest.mock('../../src/utils/agent-caller');
jest.mock('../../src/utils/with-activity-log');

const mockLogger: Logger = jest.fn();

const mockBuildClientWithActions = buildClientWithActions as jest.MockedFunction<
  typeof buildClientWithActions
>;
const mockWithActivityLog = withActivityLog as jest.MockedFunction<typeof withActivityLog>;

describe('declareExecuteActionTool', () => {
  let mcpServer: McpServer;
  let registeredToolHandler: (options: unknown, extra: unknown) => Promise<unknown>;
  let registeredToolConfig: { title: string; description: string; inputSchema: unknown };

  beforeEach(() => {
    jest.clearAllMocks();

    mcpServer = {
      registerTool: jest.fn((name, config, handler) => {
        registeredToolConfig = config;
        registeredToolHandler = handler;
      }),
    } as unknown as McpServer;

    // By default, withActivityLog executes the operation and returns its result
    mockWithActivityLog.mockImplementation(async options => options.operation());
  });

  describe('tool registration', () => {
    it('should register a tool named "executeAction"', () => {
      declareExecuteActionTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(mcpServer.registerTool).toHaveBeenCalledWith(
        'executeAction',
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should register tool with correct title and description', () => {
      declareExecuteActionTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(registeredToolConfig.title).toBe('Execute an action');
      expect(registeredToolConfig.description).toContain(
        'Execute a specific action on one or more records',
      );
      expect(registeredToolConfig.description).toContain('MUST call getActionForm first');
    });

    it('should define correct input schema', () => {
      declareExecuteActionTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(registeredToolConfig.inputSchema).toHaveProperty('collectionName');
      expect(registeredToolConfig.inputSchema).toHaveProperty('actionName');
      expect(registeredToolConfig.inputSchema).toHaveProperty('recordIds');
      expect(registeredToolConfig.inputSchema).toHaveProperty('values');
    });

    it('should use string type for collectionName when no collection names provided', () => {
      declareExecuteActionTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { options?: string[]; parse: (value: unknown) => unknown }
      >;
      expect(schema.collectionName.options).toBeUndefined();
      expect(() => schema.collectionName.parse('any-collection')).not.toThrow();
    });

    it('should use enum type for collectionName when collection names provided', () => {
      declareExecuteActionTool(mcpServer, 'https://api.forestadmin.com', mockLogger, [
        'users',
        'products',
      ]);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { options: string[]; parse: (value: unknown) => unknown }
      >;
      expect(schema.collectionName.options).toEqual(['users', 'products']);
      expect(() => schema.collectionName.parse('users')).not.toThrow();
      expect(() => schema.collectionName.parse('invalid-collection')).toThrow();
    });

    it('should accept array of strings or numbers for recordIds', () => {
      declareExecuteActionTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { parse: (value: unknown) => unknown }
      >;
      expect(() => schema.recordIds.parse(['1', '2', '3'])).not.toThrow();
      expect(() => schema.recordIds.parse([1, 2, 3])).not.toThrow();
      expect(() => schema.recordIds.parse(['1', 2, '3'])).not.toThrow();
    });

    it('should accept null for recordIds (global actions)', () => {
      declareExecuteActionTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { parse: (value: unknown) => unknown }
      >;
      expect(() => schema.recordIds.parse(null)).not.toThrow();
    });

    it('should accept optional values parameter', () => {
      declareExecuteActionTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { parse: (value: unknown) => unknown }
      >;
      expect(() => schema.values.parse(undefined)).not.toThrow();
      expect(() => schema.values.parse({ fieldName: 'value' })).not.toThrow();
    });
  });

  describe('tool execution', () => {
    const mockExtra = {
      authInfo: {
        token: 'test-token',
        extra: {
          forestServerToken: 'forest-token',
          renderingId: '123',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    beforeEach(() => {
      declareExecuteActionTool(mcpServer, 'https://api.forestadmin.com', mockLogger);
    });

    it('should call buildClientWithActions with the extra parameter and forestServerUrl', async () => {
      const mockExecute = jest.fn().mockResolvedValue({ success: 'Action executed' });
      const mockSetFields = jest.fn().mockResolvedValue(undefined);
      const mockAction = jest.fn().mockResolvedValue({
        execute: mockExecute,
        setFields: mockSetFields,
      });
      const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
      mockBuildClientWithActions.mockResolvedValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClientWithActions>);

      await registeredToolHandler(
        { collectionName: 'users', actionName: 'sendEmail', recordIds: [1, 2] },
        mockExtra,
      );

      expect(mockBuildClientWithActions).toHaveBeenCalledWith(
        mockExtra,
        'https://api.forestadmin.com',
      );
    });

    it('should call rpcClient.collection with the collection name', async () => {
      const mockExecute = jest.fn().mockResolvedValue({ success: 'Action executed' });
      const mockSetFields = jest.fn().mockResolvedValue(undefined);
      const mockAction = jest.fn().mockResolvedValue({
        execute: mockExecute,
        setFields: mockSetFields,
      });
      const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
      mockBuildClientWithActions.mockResolvedValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClientWithActions>);

      await registeredToolHandler(
        { collectionName: 'products', actionName: 'archive', recordIds: [1] },
        mockExtra,
      );

      expect(mockCollection).toHaveBeenCalledWith('products');
    });

    it('should call action with the action name and recordIds', async () => {
      const mockExecute = jest.fn().mockResolvedValue({ success: 'Action executed' });
      const mockSetFields = jest.fn().mockResolvedValue(undefined);
      const mockAction = jest.fn().mockResolvedValue({
        execute: mockExecute,
        setFields: mockSetFields,
      });
      const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
      mockBuildClientWithActions.mockResolvedValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClientWithActions>);

      const recordIds = [1, 2, 3];
      await registeredToolHandler(
        { collectionName: 'users', actionName: 'sendEmail', recordIds },
        mockExtra,
      );

      expect(mockAction).toHaveBeenCalledWith('sendEmail', { recordIds });
    });

    it('should call action with empty recordIds array when recordIds is null (global action)', async () => {
      const mockExecute = jest.fn().mockResolvedValue({ success: 'Action executed' });
      const mockSetFields = jest.fn().mockResolvedValue(undefined);
      const mockAction = jest.fn().mockResolvedValue({
        execute: mockExecute,
        setFields: mockSetFields,
      });
      const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
      mockBuildClientWithActions.mockResolvedValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClientWithActions>);

      await registeredToolHandler(
        { collectionName: 'users', actionName: 'globalAction', recordIds: null },
        mockExtra,
      );

      expect(mockAction).toHaveBeenCalledWith('globalAction', { recordIds: [] });
    });

    it('should call setFields when values are provided', async () => {
      const mockExecute = jest.fn().mockResolvedValue({ success: 'Action executed' });
      const mockSetFields = jest.fn().mockResolvedValue(undefined);
      const mockAction = jest.fn().mockResolvedValue({
        execute: mockExecute,
        setFields: mockSetFields,
      });
      const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
      mockBuildClientWithActions.mockResolvedValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClientWithActions>);

      const values = { subject: 'Test', message: 'Hello' };
      await registeredToolHandler(
        { collectionName: 'users', actionName: 'sendEmail', recordIds: [1], values },
        mockExtra,
      );

      expect(mockSetFields).toHaveBeenCalledWith(values);
    });

    it('should not call setFields when values are not provided', async () => {
      const mockExecute = jest.fn().mockResolvedValue({ success: 'Action executed' });
      const mockSetFields = jest.fn().mockResolvedValue(undefined);
      const mockAction = jest.fn().mockResolvedValue({
        execute: mockExecute,
        setFields: mockSetFields,
      });
      const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
      mockBuildClientWithActions.mockResolvedValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClientWithActions>);

      await registeredToolHandler(
        { collectionName: 'users', actionName: 'sendEmail', recordIds: [1] },
        mockExtra,
      );

      expect(mockSetFields).not.toHaveBeenCalled();
    });

    it('should call execute and return the result', async () => {
      const actionResult = { success: 'Email sent successfully', html: '<p>Done</p>' };
      const mockExecute = jest.fn().mockResolvedValue(actionResult);
      const mockSetFields = jest.fn().mockResolvedValue(undefined);
      const mockAction = jest.fn().mockResolvedValue({
        execute: mockExecute,
        setFields: mockSetFields,
      });
      const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
      mockBuildClientWithActions.mockResolvedValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClientWithActions>);

      const result = await registeredToolHandler(
        { collectionName: 'users', actionName: 'sendEmail', recordIds: [1, 2] },
        mockExtra,
      );

      expect(mockExecute).toHaveBeenCalled();
      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(actionResult) }],
      });
    });

    describe('activity logging', () => {
      beforeEach(() => {
        const mockExecute = jest.fn().mockResolvedValue({ success: 'Action executed' });
        const mockSetFields = jest.fn().mockResolvedValue(undefined);
        const mockAction = jest.fn().mockResolvedValue({
          execute: mockExecute,
          setFields: mockSetFields,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClientWithActions.mockResolvedValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClientWithActions>);
      });

      it('should call withActivityLog with correct parameters', async () => {
        const recordIds = [1, 2, 3];
        await registeredToolHandler(
          { collectionName: 'users', actionName: 'sendEmail', recordIds },
          mockExtra,
        );

        expect(mockWithActivityLog).toHaveBeenCalledWith({
          forestServerUrl: 'https://api.forestadmin.com',
          request: mockExtra,
          action: 'action',
          context: {
            collectionName: 'users',
            recordIds,
            label: 'triggered the action "sendEmail"',
          },
          logger: mockLogger,
          operation: expect.any(Function),
        });
      });

      it('should wrap the action execution with activity logging', async () => {
        const mockExecute = jest.fn().mockResolvedValue({ success: 'Action executed' });
        const mockSetFields = jest.fn().mockResolvedValue(undefined);
        const mockAction = jest.fn().mockResolvedValue({
          execute: mockExecute,
          setFields: mockSetFields,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClientWithActions.mockResolvedValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClientWithActions>);

        await registeredToolHandler(
          { collectionName: 'users', actionName: 'sendEmail', recordIds: [1] },
          mockExtra,
        );

        // Verify the operation was executed through withActivityLog
        expect(mockWithActivityLog).toHaveBeenCalled();
        expect(mockExecute).toHaveBeenCalled();
      });
    });

    describe('values parsing', () => {
      it('should parse values sent as JSON string (LLM workaround)', () => {
        const values = { subject: 'Test', message: 'Hello' };
        const valuesAsString = JSON.stringify(values);

        const inputSchema = registeredToolConfig.inputSchema as Record<
          string,
          { parse: (value: unknown) => unknown }
        >;
        const parsedValues = inputSchema.values.parse(valuesAsString);

        expect(parsedValues).toEqual(values);
      });

      it('should handle values as object when not sent as string', async () => {
        const mockExecute = jest.fn().mockResolvedValue({ success: 'Action executed' });
        const mockSetFields = jest.fn().mockResolvedValue(undefined);
        const mockAction = jest.fn().mockResolvedValue({
          execute: mockExecute,
          setFields: mockSetFields,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClientWithActions.mockResolvedValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClientWithActions>);

        const values = { subject: 'Test', message: 'Hello' };
        await registeredToolHandler(
          { collectionName: 'users', actionName: 'sendEmail', recordIds: [1], values },
          mockExtra,
        );

        expect(mockSetFields).toHaveBeenCalledWith(values);
      });
    });

    describe('error handling', () => {
      it('should parse error with nested error.text structure in message', async () => {
        const errorPayload = {
          error: {
            status: 403,
            text: JSON.stringify({
              errors: [
                { name: 'ForbiddenError', detail: 'Cannot execute action on these records' },
              ],
            }),
          },
        };
        const agentError = new Error(JSON.stringify(errorPayload));
        const mockAction = jest.fn().mockRejectedValue(agentError);
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClientWithActions.mockResolvedValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClientWithActions>);

        await expect(
          registeredToolHandler(
            { collectionName: 'users', actionName: 'sendEmail', recordIds: [1] },
            mockExtra,
          ),
        ).rejects.toThrow('Cannot execute action on these records');
      });

      it('should rethrow original error when no parsable error found', async () => {
        const agentError = { unknownProperty: 'some value' };
        const mockAction = jest.fn().mockRejectedValue(agentError);
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClientWithActions.mockResolvedValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClientWithActions>);

        await expect(
          registeredToolHandler(
            { collectionName: 'users', actionName: 'sendEmail', recordIds: [1] },
            mockExtra,
          ),
        ).rejects.toEqual(agentError);
      });
    });
  });
});
