import type { Logger } from '../../src/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import declareExecuteActionTool from '../../src/tools/execute-action';
import createActivityLog from '../../src/utils/activity-logs-creator';
import buildClient from '../../src/utils/agent-caller';

jest.mock('../../src/utils/agent-caller');
jest.mock('../../src/utils/activity-logs-creator');

const mockLogger: Logger = jest.fn();

const mockBuildClient = buildClient as jest.MockedFunction<typeof buildClient>;
const mockCreateActivityLog = createActivityLog as jest.MockedFunction<typeof createActivityLog>;

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

    mockCreateActivityLog.mockResolvedValue(undefined);
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
      expect(registeredToolConfig.description).toContain('Execute an action on a collection');
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

    it('should call buildClient with the extra parameter and actionEndpoints', async () => {
      const mockSetFields = jest.fn();
      const mockExecuteWithFileSupport = jest.fn().mockResolvedValue({
        type: 'json',
        data: { success: 'Action completed' },
      });
      const mockAction = jest.fn().mockResolvedValue({
        setFields: mockSetFields,
        executeWithFileSupport: mockExecuteWithFileSupport,
      });
      const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      await registeredToolHandler(
        { collectionName: 'users', actionName: 'Send Email', recordIds: [1] },
        mockExtra,
      );

      expect(mockBuildClient).toHaveBeenCalledWith(mockExtra, {});
    });

    it('should call rpcClient.collection with the collection name', async () => {
      const mockSetFields = jest.fn();
      const mockExecuteWithFileSupport = jest.fn().mockResolvedValue({
        type: 'json',
        data: { success: 'Action completed' },
      });
      const mockAction = jest.fn().mockResolvedValue({
        setFields: mockSetFields,
        executeWithFileSupport: mockExecuteWithFileSupport,
      });
      const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      await registeredToolHandler(
        { collectionName: 'users', actionName: 'Send Email', recordIds: [1] },
        mockExtra,
      );

      expect(mockCollection).toHaveBeenCalledWith('users');
    });

    it('should call action with action name and recordIds', async () => {
      const mockSetFields = jest.fn();
      const mockExecuteWithFileSupport = jest.fn().mockResolvedValue({
        type: 'json',
        data: { success: 'Action completed' },
      });
      const mockAction = jest.fn().mockResolvedValue({
        setFields: mockSetFields,
        executeWithFileSupport: mockExecuteWithFileSupport,
      });
      const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      await registeredToolHandler(
        { collectionName: 'users', actionName: 'Send Email', recordIds: [1, 2, 3] },
        mockExtra,
      );

      expect(mockAction).toHaveBeenCalledWith('Send Email', { recordIds: [1, 2, 3] });
    });

    it('should call setFields when values are provided', async () => {
      const mockSetFields = jest.fn();
      const mockExecuteWithFileSupport = jest.fn().mockResolvedValue({
        type: 'json',
        data: { success: 'Action completed' },
      });
      const mockAction = jest.fn().mockResolvedValue({
        setFields: mockSetFields,
        executeWithFileSupport: mockExecuteWithFileSupport,
      });
      const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      const values = { Subject: 'Hello', Body: 'World' };
      await registeredToolHandler(
        { collectionName: 'users', actionName: 'Send Email', recordIds: [1], values },
        mockExtra,
      );

      expect(mockSetFields).toHaveBeenCalledWith(values);
    });

    it('should NOT call setFields when no values provided', async () => {
      const mockSetFields = jest.fn();
      const mockExecuteWithFileSupport = jest.fn().mockResolvedValue({
        type: 'json',
        data: { success: 'Action completed' },
      });
      const mockAction = jest.fn().mockResolvedValue({
        setFields: mockSetFields,
        executeWithFileSupport: mockExecuteWithFileSupport,
      });
      const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      await registeredToolHandler(
        { collectionName: 'users', actionName: 'Send Email', recordIds: [1] },
        mockExtra,
      );

      expect(mockSetFields).not.toHaveBeenCalled();
    });

    describe('result formatting', () => {
      it('should return Success result with message', async () => {
        const mockSetFields = jest.fn();
        const mockExecuteWithFileSupport = jest.fn().mockResolvedValue({
          type: 'json',
          data: { success: 'Email sent successfully' },
        });
        const mockAction = jest.fn().mockResolvedValue({
          setFields: mockSetFields,
          executeWithFileSupport: mockExecuteWithFileSupport,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const result = (await registeredToolHandler(
          { collectionName: 'users', actionName: 'Send Email', recordIds: [1] },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsedResult = JSON.parse(result.content[0].text);
        expect(parsedResult.type).toBe('Success');
        expect(parsedResult.message).toBe('Email sent successfully');
      });

      it('should return Success result with html content', async () => {
        const mockSetFields = jest.fn();
        const mockExecuteWithFileSupport = jest.fn().mockResolvedValue({
          type: 'json',
          data: { success: 'Done', html: '<p>Result here</p>' },
        });
        const mockAction = jest.fn().mockResolvedValue({
          setFields: mockSetFields,
          executeWithFileSupport: mockExecuteWithFileSupport,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const result = (await registeredToolHandler(
          { collectionName: 'users', actionName: 'Generate Report', recordIds: [1] },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsedResult = JSON.parse(result.content[0].text);
        expect(parsedResult.type).toBe('Success');
        expect(parsedResult.html).toBe('<p>Result here</p>');
      });

      it('should return Success result with invalidatedRelations', async () => {
        const mockSetFields = jest.fn();
        const mockExecuteWithFileSupport = jest.fn().mockResolvedValue({
          type: 'json',
          data: { success: 'Done', refresh: { relationships: ['orders', 'payments'] } },
        });
        const mockAction = jest.fn().mockResolvedValue({
          setFields: mockSetFields,
          executeWithFileSupport: mockExecuteWithFileSupport,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const result = (await registeredToolHandler(
          { collectionName: 'users', actionName: 'Update Status', recordIds: [1] },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsedResult = JSON.parse(result.content[0].text);
        expect(parsedResult.type).toBe('Success');
        expect(parsedResult.invalidatedRelations).toEqual(['orders', 'payments']);
      });

      it('should return Webhook result', async () => {
        const mockSetFields = jest.fn();
        const webhookData = {
          url: 'https://api.example.com/webhook',
          method: 'POST',
          headers: { 'X-Custom': 'value' },
          body: { data: 'test' },
        };
        const mockExecuteWithFileSupport = jest.fn().mockResolvedValue({
          type: 'json',
          data: { webhook: webhookData },
        });
        const mockAction = jest.fn().mockResolvedValue({
          setFields: mockSetFields,
          executeWithFileSupport: mockExecuteWithFileSupport,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const result = (await registeredToolHandler(
          { collectionName: 'users', actionName: 'Trigger Webhook', recordIds: [1] },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsedResult = JSON.parse(result.content[0].text);
        expect(parsedResult.type).toBe('Webhook');
        expect(parsedResult.webhook).toEqual(webhookData);
      });

      it('should return Redirect result', async () => {
        const mockSetFields = jest.fn();
        const mockExecuteWithFileSupport = jest.fn().mockResolvedValue({
          type: 'json',
          data: { redirectTo: '/users/42' },
        });
        const mockAction = jest.fn().mockResolvedValue({
          setFields: mockSetFields,
          executeWithFileSupport: mockExecuteWithFileSupport,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const result = (await registeredToolHandler(
          { collectionName: 'users', actionName: 'Go To User', recordIds: [1] },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsedResult = JSON.parse(result.content[0].text);
        expect(parsedResult.type).toBe('Redirect');
        expect(parsedResult.redirectTo).toBe('/users/42');
      });

      it('should return File result for small files', async () => {
        const fileContent = Buffer.from('Hello, World!');
        const mockSetFields = jest.fn();
        const mockExecuteWithFileSupport = jest.fn().mockResolvedValue({
          type: 'file',
          buffer: fileContent,
          mimeType: 'text/plain',
          fileName: 'test.txt',
        });
        const mockAction = jest.fn().mockResolvedValue({
          setFields: mockSetFields,
          executeWithFileSupport: mockExecuteWithFileSupport,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const result = (await registeredToolHandler(
          { collectionName: 'reports', actionName: 'Download Report', recordIds: [1] },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsedResult = JSON.parse(result.content[0].text);
        expect(parsedResult.type).toBe('File');
        expect(parsedResult.fileName).toBe('test.txt');
        expect(parsedResult.mimeType).toBe('text/plain');
        expect(parsedResult.contentBase64).toBe(fileContent.toString('base64'));
        expect(parsedResult.sizeBytes).toBe(fileContent.length);
      });

      it('should return FileTooLarge result for files over 5MB', async () => {
        // Create a buffer larger than 5MB
        const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
        const mockSetFields = jest.fn();
        const mockExecuteWithFileSupport = jest.fn().mockResolvedValue({
          type: 'file',
          buffer: largeBuffer,
          mimeType: 'application/zip',
          fileName: 'large-export.zip',
        });
        const mockAction = jest.fn().mockResolvedValue({
          setFields: mockSetFields,
          executeWithFileSupport: mockExecuteWithFileSupport,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const result = (await registeredToolHandler(
          { collectionName: 'reports', actionName: 'Download Large Report', recordIds: [1] },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsedResult = JSON.parse(result.content[0].text);
        expect(parsedResult.type).toBe('FileTooLarge');
        expect(parsedResult.fileName).toBe('large-export.zip');
        expect(parsedResult.mimeType).toBe('application/zip');
        expect(parsedResult.sizeBytes).toBe(largeBuffer.length);
        expect(parsedResult.maxSizeBytes).toBe(5 * 1024 * 1024);
      });
    });

    describe('file upload conversion', () => {
      it('should convert single file value to data URI', async () => {
        const mockSetFields = jest.fn();
        const mockExecuteWithFileSupport = jest.fn().mockResolvedValue({
          type: 'json',
          data: { success: 'File uploaded' },
        });
        const mockAction = jest.fn().mockResolvedValue({
          setFields: mockSetFields,
          executeWithFileSupport: mockExecuteWithFileSupport,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const fileValue = {
          name: 'config.json',
          mimeType: 'application/json',
          contentBase64: Buffer.from('{"key":"value"}').toString('base64'),
        };

        await registeredToolHandler(
          {
            collectionName: 'documents',
            actionName: 'Import Config',
            recordIds: [1],
            values: { 'Config File': fileValue },
          },
          mockExtra,
        );

        expect(mockSetFields).toHaveBeenCalledWith({
          'Config File': `data:application/json;name=config.json;base64,${fileValue.contentBase64}`,
        });
      });

      it('should convert file array to data URI array', async () => {
        const mockSetFields = jest.fn();
        const mockExecuteWithFileSupport = jest.fn().mockResolvedValue({
          type: 'json',
          data: { success: 'Files uploaded' },
        });
        const mockAction = jest.fn().mockResolvedValue({
          setFields: mockSetFields,
          executeWithFileSupport: mockExecuteWithFileSupport,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const file1 = {
          name: 'doc1.pdf',
          mimeType: 'application/pdf',
          contentBase64: 'YmFzZTY0Y29udGVudDE=',
        };
        const file2 = {
          name: 'doc2.pdf',
          mimeType: 'application/pdf',
          contentBase64: 'YmFzZTY0Y29udGVudDI=',
        };

        await registeredToolHandler(
          {
            collectionName: 'documents',
            actionName: 'Upload Documents',
            recordIds: [1],
            values: { Documents: [file1, file2] },
          },
          mockExtra,
        );

        expect(mockSetFields).toHaveBeenCalledWith({
          Documents: [
            `data:application/pdf;name=doc1.pdf;base64,${file1.contentBase64}`,
            `data:application/pdf;name=doc2.pdf;base64,${file2.contentBase64}`,
          ],
        });
      });

      it('should encode special characters in filename', async () => {
        const mockSetFields = jest.fn();
        const mockExecuteWithFileSupport = jest.fn().mockResolvedValue({
          type: 'json',
          data: { success: 'File uploaded' },
        });
        const mockAction = jest.fn().mockResolvedValue({
          setFields: mockSetFields,
          executeWithFileSupport: mockExecuteWithFileSupport,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const fileValue = {
          name: 'my file (1).json',
          mimeType: 'application/json',
          contentBase64: 'e30=',
        };

        await registeredToolHandler(
          {
            collectionName: 'documents',
            actionName: 'Import Config',
            recordIds: [1],
            values: { File: fileValue },
          },
          mockExtra,
        );

        expect(mockSetFields).toHaveBeenCalledWith({
          File: `data:application/json;name=my%20file%20(1).json;base64,e30=`,
        });
      });

      it('should pass through non-file values unchanged', async () => {
        const mockSetFields = jest.fn();
        const mockExecuteWithFileSupport = jest.fn().mockResolvedValue({
          type: 'json',
          data: { success: 'Done' },
        });
        const mockAction = jest.fn().mockResolvedValue({
          setFields: mockSetFields,
          executeWithFileSupport: mockExecuteWithFileSupport,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        await registeredToolHandler(
          {
            collectionName: 'users',
            actionName: 'Send Email',
            recordIds: [1],
            values: { Subject: 'Hello', Count: 42, Active: true },
          },
          mockExtra,
        );

        expect(mockSetFields).toHaveBeenCalledWith({
          Subject: 'Hello',
          Count: 42,
          Active: true,
        });
      });
    });

    describe('activity logging', () => {
      beforeEach(() => {
        const mockSetFields = jest.fn();
        const mockExecuteWithFileSupport = jest.fn().mockResolvedValue({
          type: 'json',
          data: { success: 'Done' },
        });
        const mockAction = jest.fn().mockResolvedValue({
          setFields: mockSetFields,
          executeWithFileSupport: mockExecuteWithFileSupport,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);
      });

      it('should create activity log with "executeAction" action type and label', async () => {
        await registeredToolHandler(
          { collectionName: 'users', actionName: 'Send Reminder', recordIds: [42] },
          mockExtra,
        );

        expect(mockCreateActivityLog).toHaveBeenCalledWith(
          'https://api.forestadmin.com',
          mockExtra,
          'executeAction',
          { collectionName: 'users', label: 'Send Reminder' },
        );
      });
    });

    describe('input parsing', () => {
      it('should parse recordIds sent as JSON string (LLM workaround)', () => {
        const recordIds = [1, 2, 3];
        const recordIdsAsString = JSON.stringify(recordIds);

        const inputSchema = registeredToolConfig.inputSchema as Record<
          string,
          { parse: (value: unknown) => unknown }
        >;
        const parsedRecordIds = inputSchema.recordIds.parse(recordIdsAsString);

        expect(parsedRecordIds).toEqual(recordIds);
      });

      it('should parse values sent as JSON string (LLM workaround)', () => {
        const values = { Subject: 'Hello', Body: 'World' };
        const valuesAsString = JSON.stringify(values);

        const inputSchema = registeredToolConfig.inputSchema as Record<
          string,
          { parse: (value: unknown) => unknown }
        >;
        const parsedValues = inputSchema.values.parse(valuesAsString);

        expect(parsedValues).toEqual(values);
      });
    });

    describe('error handling', () => {
      it('should parse error with nested error.text structure in message', async () => {
        const errorPayload = {
          error: {
            status: 400,
            text: JSON.stringify({
              errors: [{ name: 'ValidationError', detail: 'Field is required' }],
            }),
          },
        };
        const agentError = new Error(JSON.stringify(errorPayload));
        const mockAction = jest.fn().mockRejectedValue(agentError);
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        await expect(
          registeredToolHandler(
            { collectionName: 'users', actionName: 'Test Action', recordIds: [1] },
            mockExtra,
          ),
        ).rejects.toThrow('Field is required');
      });

      it('should rethrow original error when no parsable error found', async () => {
        const agentError = { unknownProperty: 'some value' };
        const mockAction = jest.fn().mockRejectedValue(agentError);
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        await expect(
          registeredToolHandler(
            { collectionName: 'users', actionName: 'Test Action', recordIds: [1] },
            mockExtra,
          ),
        ).rejects.toEqual(agentError);
      });
    });
  });
});
