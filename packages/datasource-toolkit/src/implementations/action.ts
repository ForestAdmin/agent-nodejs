import {
  Action,
  ActionField,
  ActionForm,
  ActionResponse,
  ActionResponseType,
  ErrorResponse,
} from "../interfaces/action";
import { RecordData } from "../interfaces/query/record";

export class BaseAction implements Action {
  execute(formValues: RecordData, selection?: Selection): Promise<ActionResponse> {
    void formValues;
    void selection;

    // FIXME: `as ErrorReponse` needed for code to complile.
    return Promise.resolve({
      type: ActionResponseType.Error,
      message: "Not implemented",
      options: {
        type: "text",
      },
    } as ErrorResponse);
  }

  getForm(
    selection?: Selection,
    changedField?: string,
    formValues?: RecordData
  ): Promise<ActionForm> {
    void changedField;
    void formValues;
    void selection;

    return Promise.resolve({
      fields: [] as ActionField[],
    });
  }
}
