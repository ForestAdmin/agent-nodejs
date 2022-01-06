import { Action, ActionForm, ActionResponse } from './interfaces/action';
import { RecordData } from './interfaces/query/record';

export default abstract class BaseAction implements Action {
  abstract execute(formValues: RecordData, selection?: Selection): Promise<ActionResponse>;
  abstract getForm(
    selection?: Selection,
    changedField?: string,
    formValues?: RecordData,
  ): Promise<ActionForm>;
}
