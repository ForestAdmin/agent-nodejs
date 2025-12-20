import type { Logger } from '../../src/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import declareGetActionFormTool from '../../src/tools/get-action-form.js';
import createActivityLog from '../../src/utils/activity-logs-creator.js';
import buildClient from '../../src/utils/agent-caller.js';

jest.mock('../../src/utils/agent-caller');
jest.mock('../../src/utils/activity-logs-creator');

const mockLogger: Logger = jest.fn();

const mockBuildClient = buildClient as jest.MockedFunction<typeof buildClient>;
const mockCreateActivityLog = createActivityLog as jest.MockedFunction<typeof createActivityLog>;

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

    mockCreateActivityLog.mockResolvedValue(undefined);
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

      expect(registeredToolConfig.title).toBe('Get action form');
      expect(registeredToolConfig.description).toContain('Load the form fields for an action');
    });

    it('should define correct input schema', () => {
      declareGetActionFormTool(mcpServer, 'https://api.forestadmin.com', mockLogger);

      expect(registeredToolConfig.inputSchema).toHaveProperty('collectionName');
      expect(registeredToolConfig.inputSchema).toHaveProperty('actionName');
      expect(registeredToolConfig.inputSchema).toHaveProperty('recordIds');
      expect(registeredToolConfig.inputSchema).toHaveProperty('values');
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

    const createMockField = (
      overrides: Partial<{
        name: string;
        type: string;
        value: unknown;
        isRequired: boolean;
        isReadOnly: boolean;
        description: string;
        enums: string[];
        widgetEdit: { name: string; parameters: Record<string, unknown> };
        reference: string;
      }> = {},
    ) => {
      const plainField = {
        field: overrides.name || 'testField',
        type: overrides.type || 'String',
        value: overrides.value,
        isRequired: overrides.isRequired ?? false,
        isReadOnly: overrides.isReadOnly ?? false,
        description: overrides.description,
        enums: overrides.enums,
        widgetEdit: overrides.widgetEdit,
        reference: overrides.reference,
      };

      return {
        getName: () => plainField.field,
        getType: () => plainField.type,
        getValue: () => plainField.value,
        isRequired: () => plainField.isRequired,
        getPlainField: () => plainField,
      };
    };

    beforeEach(() => {
      declareGetActionFormTool(mcpServer, 'https://api.forestadmin.com', mockLogger);
    });

    it('should call buildClient with the extra parameter and actionEndpoints', async () => {
      const mockSetFields = jest.fn();
      const mockGetFields = jest.fn().mockReturnValue([]);
      const mockGetLayout = jest.fn().mockReturnValue({});
      const mockAction = jest.fn().mockResolvedValue({
        setFields: mockSetFields,
        getFields: mockGetFields,
        getLayout: mockGetLayout,
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

    it('should call action with action name and recordIds', async () => {
      const mockSetFields = jest.fn();
      const mockGetFields = jest.fn().mockReturnValue([]);
      const mockGetLayout = jest.fn().mockReturnValue({});
      const mockAction = jest.fn().mockResolvedValue({
        setFields: mockSetFields,
        getFields: mockGetFields,
        getLayout: mockGetLayout,
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
      const mockGetFields = jest.fn().mockReturnValue([]);
      const mockGetLayout = jest.fn().mockReturnValue({});
      const mockAction = jest.fn().mockResolvedValue({
        setFields: mockSetFields,
        getFields: mockGetFields,
        getLayout: mockGetLayout,
      });
      const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
      mockBuildClient.mockReturnValue({
        rpcClient: { collection: mockCollection },
        authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
      } as unknown as ReturnType<typeof buildClient>);

      const values = { Type: 'Pro', Country: 'France' };
      await registeredToolHandler(
        { collectionName: 'customers', actionName: 'Create Contract', recordIds: [1], values },
        mockExtra,
      );

      expect(mockSetFields).toHaveBeenCalledWith(values);
    });

    it('should NOT call setFields when no values provided', async () => {
      const mockSetFields = jest.fn();
      const mockGetFields = jest.fn().mockReturnValue([]);
      const mockGetLayout = jest.fn().mockReturnValue({});
      const mockAction = jest.fn().mockResolvedValue({
        setFields: mockSetFields,
        getFields: mockGetFields,
        getLayout: mockGetLayout,
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

    describe('field formatting', () => {
      it('should format basic field information', async () => {
        const mockField = createMockField({
          name: 'Subject',
          type: 'String',
          value: 'Default Subject',
          isRequired: true,
          isReadOnly: false,
          description: 'The email subject',
        });
        const mockSetFields = jest.fn();
        const mockGetFields = jest.fn().mockReturnValue([mockField]);
        const mockGetLayout = jest.fn().mockReturnValue({});
        const mockAction = jest.fn().mockResolvedValue({
          setFields: mockSetFields,
          getFields: mockGetFields,
          getLayout: mockGetLayout,
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
        expect(parsedResult.fields[0]).toEqual({
          name: 'Subject',
          type: 'String',
          value: 'Default Subject',
          isRequired: true,
          isReadOnly: false,
          description: 'The email subject',
          enums: null,
          options: null,
          widget: null,
          reference: null,
        });
      });

      it('should format field with enums', async () => {
        const mockField = createMockField({
          name: 'Priority',
          type: 'Enum',
          isRequired: true,
          enums: ['Low', 'Medium', 'High'],
        });
        const mockSetFields = jest.fn();
        const mockGetFields = jest.fn().mockReturnValue([mockField]);
        const mockGetLayout = jest.fn().mockReturnValue({});
        const mockAction = jest.fn().mockResolvedValue({
          setFields: mockSetFields,
          getFields: mockGetFields,
          getLayout: mockGetLayout,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const result = (await registeredToolHandler(
          { collectionName: 'tasks', actionName: 'Set Priority', recordIds: [1] },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsedResult = JSON.parse(result.content[0].text);
        expect(parsedResult.fields[0].enums).toEqual(['Low', 'Medium', 'High']);
      });

      it('should format field with widget parameters', async () => {
        const mockField = createMockField({
          name: 'Quantity',
          type: 'Number',
          widgetEdit: {
            name: 'number input',
            parameters: {
              placeholder: 'Enter quantity',
              min: 1,
              max: 100,
              step: 1,
            },
          },
        });
        const mockSetFields = jest.fn();
        const mockGetFields = jest.fn().mockReturnValue([mockField]);
        const mockGetLayout = jest.fn().mockReturnValue({});
        const mockAction = jest.fn().mockResolvedValue({
          setFields: mockSetFields,
          getFields: mockGetFields,
          getLayout: mockGetLayout,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const result = (await registeredToolHandler(
          { collectionName: 'orders', actionName: 'Update Quantity', recordIds: [1] },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsedResult = JSON.parse(result.content[0].text);
        expect(parsedResult.fields[0].widget).toEqual({
          type: 'number input',
          placeholder: 'Enter quantity',
          min: 1,
          max: 100,
          step: 1,
        });
      });

      it('should format file field with file constraints', async () => {
        const mockField = createMockField({
          name: 'Document',
          type: 'File',
          widgetEdit: {
            name: 'file picker',
            parameters: {
              filesExtensions: ['.pdf', '.doc', '.docx'],
              filesSizeLimit: 10,
              filesCountLimit: 5,
            },
          },
        });
        const mockSetFields = jest.fn();
        const mockGetFields = jest.fn().mockReturnValue([mockField]);
        const mockGetLayout = jest.fn().mockReturnValue({});
        const mockAction = jest.fn().mockResolvedValue({
          setFields: mockSetFields,
          getFields: mockGetFields,
          getLayout: mockGetLayout,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const result = (await registeredToolHandler(
          { collectionName: 'documents', actionName: 'Upload', recordIds: [1] },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsedResult = JSON.parse(result.content[0].text);
        expect(parsedResult.fields[0].widget).toEqual({
          type: 'file picker',
          allowedExtensions: ['.pdf', '.doc', '.docx'],
          maxSizeMb: 10,
          maxFiles: 5,
        });
      });

      it('should format field with dropdown options', async () => {
        const mockField = createMockField({
          name: 'Country',
          type: 'String',
          widgetEdit: {
            name: 'dropdown',
            parameters: {
              isSearchable: true,
              static: {
                options: [
                  { label: 'France', value: 'FR' },
                  { label: 'Germany', value: 'DE' },
                ],
              },
            },
          },
        });
        const mockSetFields = jest.fn();
        const mockGetFields = jest.fn().mockReturnValue([mockField]);
        const mockGetLayout = jest.fn().mockReturnValue({});
        const mockAction = jest.fn().mockResolvedValue({
          setFields: mockSetFields,
          getFields: mockGetFields,
          getLayout: mockGetLayout,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const result = (await registeredToolHandler(
          { collectionName: 'users', actionName: 'Set Country', recordIds: [1] },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsedResult = JSON.parse(result.content[0].text);
        expect(parsedResult.fields[0].options).toEqual([
          { label: 'France', value: 'FR' },
          { label: 'Germany', value: 'DE' },
        ]);
        expect(parsedResult.fields[0].widget.isSearchable).toBe(true);
      });

      it('should format Collection field with reference', async () => {
        const mockField = createMockField({
          name: 'Assigned User',
          type: 'Collection',
          reference: 'users.id',
          widgetEdit: {
            name: 'dropdown',
            parameters: {
              searchType: 'dynamic',
            },
          },
        });
        const mockSetFields = jest.fn();
        const mockGetFields = jest.fn().mockReturnValue([mockField]);
        const mockGetLayout = jest.fn().mockReturnValue({});
        const mockAction = jest.fn().mockResolvedValue({
          setFields: mockSetFields,
          getFields: mockGetFields,
          getLayout: mockGetLayout,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const result = (await registeredToolHandler(
          { collectionName: 'tasks', actionName: 'Assign Task', recordIds: [1] },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsedResult = JSON.parse(result.content[0].text);
        expect(parsedResult.fields[0].reference).toBe('users.id');
        expect(parsedResult.fields[0].widget.hasDynamicSearch).toBe(true);
      });
    });

    describe('layout formatting', () => {
      it('should return null layout when no layout provided', async () => {
        const mockSetFields = jest.fn();
        const mockGetFields = jest.fn().mockReturnValue([]);
        const mockGetLayout = jest.fn().mockReturnValue({});
        const mockAction = jest.fn().mockResolvedValue({
          setFields: mockSetFields,
          getFields: mockGetFields,
          getLayout: mockGetLayout,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const result = (await registeredToolHandler(
          { collectionName: 'users', actionName: 'Simple Action', recordIds: [1] },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsedResult = JSON.parse(result.content[0].text);
        expect(parsedResult.layout).toBeNull();
      });

      it('should format single-page layout', async () => {
        const mockSetFields = jest.fn();
        const mockGetFields = jest.fn().mockReturnValue([]);
        const mockGetLayout = jest.fn().mockReturnValue({
          layout: [
            { component: 'input', fieldId: 'field1' },
            { component: 'input', fieldId: 'field2' },
          ],
        });
        const mockAction = jest.fn().mockResolvedValue({
          setFields: mockSetFields,
          getFields: mockGetFields,
          getLayout: mockGetLayout,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const result = (await registeredToolHandler(
          { collectionName: 'users', actionName: 'Form Action', recordIds: [1] },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsedResult = JSON.parse(result.content[0].text);
        expect(parsedResult.layout).toEqual({
          type: 'single-page',
          elements: [
            { component: 'input', fieldId: 'field1' },
            { component: 'input', fieldId: 'field2' },
          ],
        });
      });

      it('should format multi-page layout', async () => {
        const mockSetFields = jest.fn();
        const mockGetFields = jest.fn().mockReturnValue([]);
        const mockGetLayout = jest.fn().mockReturnValue({
          layout: [
            {
              component: 'page',
              elements: [{ component: 'input', fieldId: 'field1' }],
              nextButtonLabel: 'Next',
            },
            {
              component: 'page',
              elements: [{ component: 'input', fieldId: 'field2' }],
              previousButtonLabel: 'Back',
              nextButtonLabel: 'Submit',
            },
          ],
        });
        const mockAction = jest.fn().mockResolvedValue({
          setFields: mockSetFields,
          getFields: mockGetFields,
          getLayout: mockGetLayout,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);

        const result = (await registeredToolHandler(
          { collectionName: 'customers', actionName: 'Wizard Action', recordIds: [1] },
          mockExtra,
        )) as { content: { type: string; text: string }[] };

        const parsedResult = JSON.parse(result.content[0].text);
        expect(parsedResult.layout).toEqual({
          type: 'multi-page',
          pages: [
            {
              pageNumber: 1,
              elements: [{ component: 'input', fieldId: 'field1' }],
              nextButtonLabel: 'Next',
            },
            {
              pageNumber: 2,
              elements: [{ component: 'input', fieldId: 'field2' }],
              previousButtonLabel: 'Back',
              nextButtonLabel: 'Submit',
            },
          ],
        });
      });
    });

    describe('activity logging', () => {
      beforeEach(() => {
        const mockSetFields = jest.fn();
        const mockGetFields = jest.fn().mockReturnValue([]);
        const mockGetLayout = jest.fn().mockReturnValue({});
        const mockAction = jest.fn().mockResolvedValue({
          setFields: mockSetFields,
          getFields: mockGetFields,
          getLayout: mockGetLayout,
        });
        const mockCollection = jest.fn().mockReturnValue({ action: mockAction });
        mockBuildClient.mockReturnValue({
          rpcClient: { collection: mockCollection },
          authData: { userId: 1, renderingId: '123', environmentId: 1, projectId: 1 },
        } as unknown as ReturnType<typeof buildClient>);
      });

      it('should create activity log with "getActionForm" action type and label', async () => {
        await registeredToolHandler(
          { collectionName: 'users', actionName: 'Send Reminder', recordIds: [42] },
          mockExtra,
        );

        expect(mockCreateActivityLog).toHaveBeenCalledWith(
          'https://api.forestadmin.com',
          mockExtra,
          'getActionForm',
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
        const values = { Type: 'Pro', Country: 'France' };
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
              errors: [{ name: 'ValidationError', detail: 'Action not found' }],
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
            { collectionName: 'users', actionName: 'Unknown Action', recordIds: [1] },
            mockExtra,
          ),
        ).rejects.toThrow('Action not found');
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
