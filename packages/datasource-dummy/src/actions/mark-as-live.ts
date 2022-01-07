import {
  Action,
  RecordData,
  ActionResponse,
  ActionResponseType,
  ActionForm,
} from '@forestadmin/datasource-toolkit';

export default class MarkAsLiveAction implements Action {
  async execute(formValues: RecordData, selection?: Selection): Promise<ActionResponse> {
    void formValues;
    void selection;

    return {
      type: ActionResponseType.Success,
      message: 'Record set as active',
      options: {
        type: 'text',
      },
    };
  }

  async getForm(
    selection?: Selection,
    changedField?: string,
    formValues?: RecordData,
  ): Promise<ActionForm> {
    void selection;
    void changedField;
    void formValues;

    return { fields: [] };
  }
}
