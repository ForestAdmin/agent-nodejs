import type { Logger } from '../../src/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import declareGetActionFormTool from '../../src/tools/get-action-form';
import { buildClientWithActions } from '../../src/utils/agent-caller';

jest.mock('../../src/utils/agent-caller');

const mockLogger: Logger = jest.fn();

const mockBuildClientWithActions = buildClientWithActions as jest.MockedFunction<
  typeof buildClientWithActions
>;

describe('declareGetActionFormTool', () => {
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
  });

  describe('tool registration', () => {
    it('should register a tool named "getActionForm"', () => {
      declareGetActionFormTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(mcpServer.registerTool).toHaveBeenCalledWith(
        'getActionForm',
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should register tool with correct title and description', () => {
      declareGetActionFormTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(registeredToolConfig.title).toBe('Retrieve action form');
      expect(registeredToolConfig.description).toContain(
        'Retrieve and validate the form for a specific action',
      );
      expect(registeredToolConfig.description).toContain('canExecute');
    });

    it('should define correct input schema', () => {
      declareGetActionFormTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(registeredToolConfig.inputSchema).toHaveProperty('collectionName');
      expect(registeredToolConfig.inputSchema).toHaveProperty('actionName');
      expect(registeredToolConfig.inputSchema).toHaveProperty('recordIds');
      expect(registeredToolConfig.inputSchema).toHaveProperty('values');
    });

    it('should use string type for collectionName when no collection names provided', () => {
      declareGetActionFormTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { options?: string[]; parse: (value: unknown) => unknown }
      >;
      expect(schema.collectionName.options).toBeUndefined();
      expect(() => schema.collectionName.parse('any-collection')).not.toThrow();
    });

    it('should use enum type for collectionName when collection names provided', () => {
      declareGetActionFormTool(mcpServer, 'https://api.forestadmin.com', mockLogger, [
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
      declareGetActionFormTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { parse: (value: unknown) => unknown }
      >;
      expect(() => schema.recordIds.parse(['1', '2', '3'])).not.toThrow();
      expect(() => schema.recordIds.parse([1, 2, 3])).not.toThrow();
      expect(() => schema.recordIds.parse(['1', 2, '3'])).not.toThrow();
    });

    it('should accept null for recordIds (global actions)', () => {
      declareGetActionFormTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      const schema = registeredToolConfig.inputSchema as Record<
        string,
        { parse: (value: unknown) => unknown }
      >;
      expect(() => schema.recordIds.parse(null)).not.toThrow();
    });

    it('should accept optional values parameter', () => {
      declareGetActionFormTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

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
      declareGetActionFormTool(mcpServer, 'https://api.forestadmin.com', mockLogger);
    });

    it('should call buildClientWithActions with the extra parameter and forestServerUrl', async () => {
      const mockGetFields = jest.fn().mockReturnValue([]);
      const mockSetFields = jest.fn().mockResolvedValue(undefined);
      const mockAction = jest.fn().mockResolvedValue({
        getFields: mockGetFields,
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
      const mockGetFields = jest.fn().mockReturnValue([]);
      const mockSetFields = jest.fn().mockResolvedValue(undefined);
      const mockAction = jest.fn().mockResolvedValue({
        getFields: mockGetFields,
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
      const mockGetFields = jest.fn().mockReturnValue([]);
      const mockSetFields = jest.fn().mockResolvedValue(undefined);
      const mockAction = jest.fn().mockResolvedValue({
        getFields: mockGetFields,
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

    it('should call setFields when values are provided', async () => {
      const mockGetFields = jest.fn().mockReturnValue([]);
      const mockSetFields = jest.fn().mockResolvedValue(undefined);
      const mockAction = jest.fn().mockResolvedValue({
        getFields: mockGetFields,
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
      const mockGetFields = jest.fn().mockReturnValue([]);
      const mockSetFields = jest.fn().mockResolvedValue(undefined);
      const mockAction = jest.fn().mockResolvedValue({
        getFields: mockGetFields,
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

    it('should return form fields with their properties', async () => {
      const mockFields = [
        {
          getName: () => 'subject',
          getType: () => 'String',
          getValue: () => undefined,
          isRequired: () => true,
        },
        {
          getName: () => 'message',
          getType: () => 'String',
          getValue: () => 'Default message',
          isRequired: () => false,
        },
      ];
      const mockGetFields = jest.fn().mockReturnValue(mockFields);
      const mockSetFields = jest.fn().mockResolvedValue(undefined);
      const mockAction = jest.fn().mockResolvedValue({
        getFields: mockGetFields,
        setFields: mockSetFields,
      });
      const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
      mockBuildClientWithActions.mockResolvedValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClientWithActions>);

      const result = await registeredToolHandler(
        { collectionName: 'users', actionName: 'sendEmail', recordIds: [1] },
        mockExtra,
      );

      const expectedResponse = {
        fields: [
          { name: 'subject', type: 'String', value: undefined, isRequired: true },
          { name: 'message', type: 'String', value: 'Default message', isRequired: false },
        ],
        canExecute: false,
        requiredFields: ['subject'],
      };

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(expectedResponse) }],
      });
    });

    it('should return canExecute true when all required fields have values', async () => {
      const mockFields = [
        {
          getName: () => 'subject',
          getType: () => 'String',
          getValue: () => 'Test Subject',
          isRequired: () => true,
        },
        {
          getName: () => 'message',
          getType: () => 'String',
          getValue: () => 'Test Message',
          isRequired: () => true,
        },
      ];
      const mockGetFields = jest.fn().mockReturnValue(mockFields);
      const mockSetFields = jest.fn().mockResolvedValue(undefined);
      const mockAction = jest.fn().mockResolvedValue({
        getFields: mockGetFields,
        setFields: mockSetFields,
      });
      const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
      mockBuildClientWithActions.mockResolvedValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClientWithActions>);

      const result = await registeredToolHandler(
        { collectionName: 'users', actionName: 'sendEmail', recordIds: [1] },
        mockExtra,
      );

      const parsedResult = JSON.parse((result as { content: { text: string }[] }).content[0].text);
      expect(parsedResult.canExecute).toBe(true);
      expect(parsedResult.requiredFields).toEqual([]);
    });

    it('should return canExecute false when some required fields are missing values', async () => {
      const mockFields = [
        {
          getName: () => 'subject',
          getType: () => 'String',
          getValue: () => undefined,
          isRequired: () => true,
        },
        {
          getName: () => 'message',
          getType: () => 'String',
          getValue: () => 'Test Message',
          isRequired: () => false,
        },
      ];
      const mockGetFields = jest.fn().mockReturnValue(mockFields);
      const mockSetFields = jest.fn().mockResolvedValue(undefined);
      const mockAction = jest.fn().mockResolvedValue({
        getFields: mockGetFields,
        setFields: mockSetFields,
      });
      const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
      mockBuildClientWithActions.mockResolvedValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClientWithActions>);

      const result = await registeredToolHandler(
        { collectionName: 'users', actionName: 'sendEmail', recordIds: [1] },
        mockExtra,
      );

      const parsedResult = JSON.parse((result as { content: { text: string }[] }).content[0].text);
      expect(parsedResult.canExecute).toBe(false);
      expect(parsedResult.requiredFields).toEqual(['subject']);
    });

    it('should return canExecute true when required field has falsy value 0', async () => {
      const mockFields = [
        {
          getName: () => 'quantity',
          getType: () => 'Number',
          getValue: () => 0,
          isRequired: () => true,
        },
      ];
      const mockGetFields = jest.fn().mockReturnValue(mockFields);
      const mockSetFields = jest.fn().mockResolvedValue(undefined);
      const mockAction = jest.fn().mockResolvedValue({
        getFields: mockGetFields,
        setFields: mockSetFields,
      });
      const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
      mockBuildClientWithActions.mockResolvedValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClientWithActions>);

      const result = await registeredToolHandler(
        { collectionName: 'users', actionName: 'updateQuantity', recordIds: [1] },
        mockExtra,
      );

      const parsedResult = JSON.parse((result as { content: { text: string }[] }).content[0].text);
      expect(parsedResult.canExecute).toBe(true);
      expect(parsedResult.requiredFields).toEqual([]);
    });

    it('should return canExecute true when required field has falsy value false', async () => {
      const mockFields = [
        {
          getName: () => 'isActive',
          getType: () => 'Boolean',
          getValue: () => false,
          isRequired: () => true,
        },
      ];
      const mockGetFields = jest.fn().mockReturnValue(mockFields);
      const mockSetFields = jest.fn().mockResolvedValue(undefined);
      const mockAction = jest.fn().mockResolvedValue({
        getFields: mockGetFields,
        setFields: mockSetFields,
      });
      const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
      mockBuildClientWithActions.mockResolvedValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClientWithActions>);

      const result = await registeredToolHandler(
        { collectionName: 'users', actionName: 'setStatus', recordIds: [1] },
        mockExtra,
      );

      const parsedResult = JSON.parse((result as { content: { text: string }[] }).content[0].text);
      expect(parsedResult.canExecute).toBe(true);
      expect(parsedResult.requiredFields).toEqual([]);
    });

    it('should return canExecute true when required field has empty string value', async () => {
      const mockFields = [
        {
          getName: () => 'notes',
          getType: () => 'String',
          getValue: () => '',
          isRequired: () => true,
        },
      ];
      const mockGetFields = jest.fn().mockReturnValue(mockFields);
      const mockSetFields = jest.fn().mockResolvedValue(undefined);
      const mockAction = jest.fn().mockResolvedValue({
        getFields: mockGetFields,
        setFields: mockSetFields,
      });
      const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
      mockBuildClientWithActions.mockResolvedValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClientWithActions>);

      const result = await registeredToolHandler(
        { collectionName: 'users', actionName: 'addNotes', recordIds: [1] },
        mockExtra,
      );

      const parsedResult = JSON.parse((result as { content: { text: string }[] }).content[0].text);
      expect(parsedResult.canExecute).toBe(true);
      expect(parsedResult.requiredFields).toEqual([]);
    });

    it('should return canExecute false when required field has null value', async () => {
      const mockFields = [
        {
          getName: () => 'subject',
          getType: () => 'String',
          getValue: () => null,
          isRequired: () => true,
        },
      ];
      const mockGetFields = jest.fn().mockReturnValue(mockFields);
      const mockSetFields = jest.fn().mockResolvedValue(undefined);
      const mockAction = jest.fn().mockResolvedValue({
        getFields: mockGetFields,
        setFields: mockSetFields,
      });
      const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
      mockBuildClientWithActions.mockResolvedValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClientWithActions>);

      const result = await registeredToolHandler(
        { collectionName: 'users', actionName: 'sendEmail', recordIds: [1] },
        mockExtra,
      );

      const parsedResult = JSON.parse((result as { content: { text: string }[] }).content[0].text);
      expect(parsedResult.canExecute).toBe(false);
      expect(parsedResult.requiredFields).toEqual(['subject']);
    });

    it('should return canExecute true when there are no required fields', async () => {
      const mockFields = [
        {
          getName: () => 'optionalField',
          getType: () => 'String',
          getValue: () => undefined,
          isRequired: () => false,
        },
      ];
      const mockGetFields = jest.fn().mockReturnValue(mockFields);
      const mockSetFields = jest.fn().mockResolvedValue(undefined);
      const mockAction = jest.fn().mockResolvedValue({
        getFields: mockGetFields,
        setFields: mockSetFields,
      });
      const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
      mockBuildClientWithActions.mockResolvedValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClientWithActions>);

      const result = await registeredToolHandler(
        { collectionName: 'users', actionName: 'sendEmail', recordIds: [1] },
        mockExtra,
      );

      const parsedResult = JSON.parse((result as { content: { text: string }[] }).content[0].text);
      expect(parsedResult.canExecute).toBe(true);
      expect(parsedResult.requiredFields).toEqual([]);
    });

    it('should handle empty fields array', async () => {
      const mockGetFields = jest.fn().mockReturnValue([]);
      const mockSetFields = jest.fn().mockResolvedValue(undefined);
      const mockAction = jest.fn().mockResolvedValue({
        getFields: mockGetFields,
        setFields: mockSetFields,
      });
      const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
      mockBuildClientWithActions.mockResolvedValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClientWithActions>);

      const result = await registeredToolHandler(
        { collectionName: 'users', actionName: 'sendEmail', recordIds: [1] },
        mockExtra,
      );

      const expectedResponse = {
        fields: [],
        canExecute: true,
        requiredFields: [],
      };

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(expectedResponse) }],
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
        const mockGetFields = jest.fn().mockReturnValue([]);
        const mockSetFields = jest.fn().mockResolvedValue(undefined);
        const mockAction = jest.fn().mockResolvedValue({
          getFields: mockGetFields,
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
      it('should propagate errors from the action call', async () => {
        const agentError = new Error('Action not found');
        const mockAction = jest.fn().mockRejectedValue(agentError);
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClientWithActions.mockResolvedValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClientWithActions>);

        await expect(
          registeredToolHandler(
            { collectionName: 'users', actionName: 'nonExistent', recordIds: [1] },
            mockExtra,
          ),
        ).rejects.toThrow('Action not found');
      });

      it('should propagate errors from setFields call', async () => {
        const setFieldsError = new Error('Invalid field value');
        const mockGetFields = jest.fn().mockReturnValue([]);
        const mockSetFields = jest.fn().mockRejectedValue(setFieldsError);
        const mockAction = jest.fn().mockResolvedValue({
          getFields: mockGetFields,
          setFields: mockSetFields,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClientWithActions.mockResolvedValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClientWithActions>);

        await expect(
          registeredToolHandler(
            {
              collectionName: 'users',
              actionName: 'sendEmail',
              recordIds: [1],
              values: { invalidField: 'value' },
            },
            mockExtra,
          ),
        ).rejects.toThrow('Invalid field value');
      });
    });
  });
});
