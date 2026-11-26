import type {
  ForestSchemaCollection,
  ForestServerClient,
  GetMcpWorkflowByIdParams,
  GetMcpWorkflowRunParams,
  HydratedWorkflowRun,
  ListMcpWorkflowsParams,
  McpWorkflow,
  McpWorkflowLookup,
  SchemaServiceInterface,
  SemanticLayerActionParams,
  SemanticLayerCollection,
  SemanticLayerCollectionParams,
  SemanticLayerDescription,
  TriggerMcpWorkflowParams,
  WorkflowRunTriggerResult,
  WorkflowsServiceInterface,
} from './types';

import { ServerUtils } from '@forestadmin/forestadmin-client';

export default class ForestServerClientImpl implements ForestServerClient {
  constructor(
    private readonly schemaService: SchemaServiceInterface,
    private readonly workflowsService: WorkflowsServiceInterface,
    public readonly forestServerUrl: string,
  ) {}

  async fetchSchema(): Promise<ForestSchemaCollection[]> {
    return this.schemaService.getSchema();
  }

  async listMcpEnabledWorkflows(params: ListMcpWorkflowsParams): Promise<McpWorkflow[]> {
    return this.workflowsService.listMcpEnabledWorkflows(params);
  }

  async getMcpWorkflowById(params: GetMcpWorkflowByIdParams): Promise<McpWorkflowLookup> {
    return this.workflowsService.getMcpWorkflowById(params);
  }

  async triggerMcpWorkflow(params: TriggerMcpWorkflowParams): Promise<WorkflowRunTriggerResult> {
    return this.workflowsService.triggerMcpWorkflow(params);
  }

  async getMcpWorkflowRun(params: GetMcpWorkflowRunParams): Promise<HydratedWorkflowRun> {
    return this.workflowsService.getMcpWorkflowRun(params);
  }

  async getSemanticLayerCollection({
    forestServerToken,
    environmentId,
    collectionName,
  }: SemanticLayerCollectionParams): Promise<SemanticLayerCollection> {
    return this.readSemanticLayer(
      forestServerToken,
      `/api/environments/${environmentId}/semantic-layer/collections/${encodeURIComponent(
        collectionName,
      )}`,
    );
  }

  async getSemanticLayerActionDescription({
    forestServerToken,
    environmentId,
    collectionName,
    actionName,
  }: SemanticLayerActionParams): Promise<SemanticLayerDescription> {
    return this.readSemanticLayer(
      forestServerToken,
      `/api/environments/${environmentId}/semantic-layer/descriptions/collections/${encodeURIComponent(
        collectionName,
      )}/actions/${encodeURIComponent(actionName)}`,
    );
  }

  private readSemanticLayer<T>(bearerToken: string, path: string): Promise<T> {
    return ServerUtils.queryWithBearerToken<T>({
      forestServerUrl: this.forestServerUrl,
      method: 'get',
      path,
      bearerToken,
      headers: { 'Forest-Application-Source': 'MCP' },
    });
  }
}
