import type { ActionContext, TSchema } from '@forestadmin/datasource-customizer';
import type { ActionResult } from '@forestadmin/datasource-toolkit';
import type { UpdateRecordAction } from '@forestadmin/forestadmin-client';

import { BusinessError } from '@forestadmin/datasource-toolkit';

const genericErrorMessage = actionName =>
  `The no-code action <strong>${actionName}</strong> cannot be triggered due to a` +
  ' misconfiguration. Please contact your administrator.';

export default async function executeUpdateRecord<S extends TSchema = TSchema>(
  action: UpdateRecordAction,
  context: ActionContext<S>,
): Promise<ActionResult> {
  try {
    const {
      configuration: {
        configuration: { fields: fieldsToUpdate },
      },
    } = action;

    const fields = fieldsToUpdate.reduce((fieldsAccumulator, fieldToUpdate) => {
      return { ...fieldsAccumulator, [fieldToUpdate.fieldName]: fieldToUpdate.value };
    }, {});

    await context.collection.update(context.filter, fields);
  } catch (error) {
    if (error instanceof BusinessError) {
      return {
        type: 'Error',
        message: `${genericErrorMessage(action.name)}<br/>(${error.name}: ${error.message})`,
      };
    }

    return {
      type: 'Error',
      message: genericErrorMessage(action.name),
    };
  }
}
