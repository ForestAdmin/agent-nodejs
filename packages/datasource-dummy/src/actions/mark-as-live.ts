import {
  Action,
  ActionField,
  ActionResponse,
  ActionResponseType,
  Filter,
  RecordData,
} from '@forestadmin/datasource-toolkit';

export default class MarkAsLiveAction implements Action {
  async execute(formValues?: RecordData, filter?: Filter): Promise<ActionResponse> {
    void formValues;
    void filter;

    return {
      type: ActionResponseType.Success,
      message: 'Record set as active',
      format: 'text',
      invalidated: new Set(),
    };
  }

  async getForm(formValues?: RecordData, filter?: Filter): Promise<ActionField[]> {
    void formValues;
    void filter;

    return [];
  }
}
