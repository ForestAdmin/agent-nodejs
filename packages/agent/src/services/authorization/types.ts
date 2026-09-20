export interface SmartActionRequestBody {
  data: {
    id: string;
    type: string;
    attributes: {
      requester_id: number;
      ids: Array<string>;
      collection_name: string;
      smart_action_id: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      values: Record<string, any> | null;
      parent_collection_name: string | null;
      parent_collection_id: string | null;
      parent_association_name: string | null;
      all_records: boolean;
      all_records_subset_query: null;
      action_intent_params?: Record<string, unknown> | null;
    };
  };
}

export interface SmartActionHookRequestBody extends SmartActionRequestBody {
  data: SmartActionRequestBody['data'] & {
    attributes: SmartActionRequestBody['data']['attributes'] & {
      changed_field: string;
      search_field: string;
      search_value: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: any[];
    };
  };
}

export interface SmartActionApprovalRequestBody extends SmartActionRequestBody {
  data: SmartActionRequestBody['data'] & {
    attributes: SmartActionRequestBody['data']['attributes'] & {
      signed_approval_request: string;
    };
  };
}
