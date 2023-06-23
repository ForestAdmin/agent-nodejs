import { ActionContext, TSchema } from '@forestadmin/datasource-customizer';
import { ActionResult, BusinessError } from '@forestadmin/datasource-toolkit';
import { UpdateRecordAction } from '@forestadmin/forestadmin-client';

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

    const fields = fieldsToUpdate.reduce((acc, fieldToUpdate) => {
      return { ...acc, [fieldToUpdate.fieldName]: fieldToUpdate.value };
    }, {});

    await context.collection.update(context.filter, fields);
  } catch (error) {
    if (error instanceof BusinessError) {
      return {
        type: 'Error',
        message:
          `The no-code action ${action.name} cannot be triggered due to misconfiguration.` +
          ` Please contact your administrator.\n(${error.name}: ${error.message})`,
      };
    }

    return {
      type: 'Error',
      message:
        `The no-code action ${action.name} cannot be triggered due to misconfiguration.` +
        ` Please contact your administrator.`,
    };
  }
}
