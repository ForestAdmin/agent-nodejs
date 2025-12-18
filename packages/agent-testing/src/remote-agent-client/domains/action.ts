import type HttpRequester from '../http-requester';

import jsonwebtoken from 'jsonwebtoken';

import ActionField from '../action-fields/action-field';
import ActionFieldCheckbox from '../action-fields/action-field-checkbox';
import ActionFieldCheckboxGroup from '../action-fields/action-field-checkbox-group';
import ActionFieldColorPicker from '../action-fields/action-field-color-picker';
import ActionFieldDate from '../action-fields/action-field-date';
import ActionFieldDropdown from '../action-fields/action-field-dropdown';
import ActionFieldEnum from '../action-fields/action-field-enum';
import ActionFieldJson from '../action-fields/action-field-json';
import ActionFieldNumber from '../action-fields/action-field-number';
import ActionFieldNumberList from '../action-fields/action-field-number-list';
import ActionFieldRadioGroup from '../action-fields/action-field-radio-group';
import ActionFieldString from '../action-fields/action-field-string';
import ActionFieldStringList from '../action-fields/action-field-string-list';
import FieldFormStates from '../action-fields/field-form-states';
import ActionLayoutRoot from '../action-layout/action-layout-root';

export type BaseActionContext = {
  recordId?: string | number;
  recordIds?: string[] | number[];
};

export type ActionEndpointsByCollection = {
  [collectionName: string]: {
    [actionName: string]: { name: string; endpoint: string };
  };
};
export default class Action<TypingsSchema> {
  private readonly collectionName: keyof TypingsSchema;

  private readonly httpRequester: HttpRequester;
  protected readonly fieldsFormStates: FieldFormStates<TypingsSchema>;
  private readonly ids: (string | number)[];
  private actionPath: string;

  constructor(
    collectionName: keyof TypingsSchema,
    httpRequester: HttpRequester,
    actionPath: string,
    fieldsFormStates: FieldFormStates<TypingsSchema>,
    ids?: (string | number)[],
  ) {
    this.collectionName = collectionName;
    this.httpRequester = httpRequester;
    this.ids = ids ?? undefined;
    this.actionPath = actionPath;
    this.fieldsFormStates = fieldsFormStates;
  }

  async execute(validateApproval?: boolean): Promise<{ success: string; html?: string }> {
    const requestBody = {
      data: {
        attributes: {
          collection_name: this.collectionName,
          ids: this.ids,
          values: this.fieldsFormStates.getFieldValues(),
          signed_approval_request: validateApproval ? this.getSignedApprovalRequest() : undefined,
        },
        type: 'custom-action-requests',
      },
    };

    return this.httpRequester.query<{ success: string }>({
      method: 'post',
      path: this.actionPath,
      body: requestBody,
    });
  }

  private getSignedApprovalRequest(): string | undefined {
    return jsonwebtoken.sign(
      {
        data: {
          attributes: {
            status: 'in-progress',
            closed_at: null,
            updated_at: new Date().toISOString(),
            error_message: null,
            requester_id: 1,
          },
        },
      },
      this.httpRequester.agentOptions.envSecret,
      { expiresIn: '1 hours' },
    );
  }

  async setFields(fields: Record<string, unknown>): Promise<void> {
    for (const [fieldName, value] of Object.entries(fields)) {
      // eslint-disable-next-line no-await-in-loop
      await this.fieldsFormStates.setFieldValue(fieldName, value);
    }
  }

  getFields() {
    return this.fieldsFormStates.getFields().map(f => {
      return this.getField(f.getName());
    });
  }

  getField(fieldName: string): ActionField<TypingsSchema> {
    const field = this.fieldsFormStates.getField(fieldName);
    const type =
      typeof field.getType() === 'string' ? field.getType() : JSON.stringify(field.getType());

    switch (type) {
      case 'Number':
        return this.getFieldNumber(fieldName);
      case 'Json':
        return this.getFieldJson(fieldName);
      case 'NumberList':
      case '["Number"]':
        return this.getFieldNumberList(fieldName);
      case 'StringList':
      case '["String"]':
        return this.getFieldStringList(fieldName);
      case 'Boolean':
        return this.getCheckboxField(fieldName);
      case 'Date':
        return this.getDateField(fieldName);
      case 'Enum':
        return this.getEnumField(fieldName);
      case 'String':
      default:
        return this.getFieldString(fieldName);
    }
  }

  getFieldNumber(fieldName: string): ActionFieldNumber<TypingsSchema> {
    return new ActionFieldNumber<TypingsSchema>(fieldName, this.fieldsFormStates);
  }

  getFieldJson(fieldName: string): ActionFieldJson<TypingsSchema> {
    return new ActionFieldJson<TypingsSchema>(fieldName, this.fieldsFormStates);
  }

  getFieldNumberList(fieldName: string): ActionFieldNumberList<TypingsSchema> {
    return new ActionFieldNumberList<TypingsSchema>(fieldName, this.fieldsFormStates);
  }

  getFieldString(fieldName: string): ActionFieldString<TypingsSchema> {
    return new ActionFieldString<TypingsSchema>(fieldName, this.fieldsFormStates);
  }

  getFieldStringList(fieldName: string): ActionFieldStringList<TypingsSchema> {
    return new ActionFieldStringList<TypingsSchema>(fieldName, this.fieldsFormStates);
  }

  getDropdownField(fieldName: string): ActionFieldDropdown<TypingsSchema> {
    return new ActionFieldDropdown<TypingsSchema>(fieldName, this.fieldsFormStates);
  }

  getCheckboxField(fieldName: string): ActionFieldCheckbox<TypingsSchema> {
    return new ActionFieldCheckbox<TypingsSchema>(fieldName, this.fieldsFormStates);
  }

  getCheckboxGroupField(fieldName: string): ActionFieldCheckboxGroup<TypingsSchema> {
    return new ActionFieldCheckboxGroup<TypingsSchema>(fieldName, this.fieldsFormStates);
  }

  getColorPickerField(fieldName: string): ActionFieldColorPicker<TypingsSchema> {
    return new ActionFieldColorPicker<TypingsSchema>(fieldName, this.fieldsFormStates);
  }

  getDateField(fieldName: string): ActionFieldDate<TypingsSchema> {
    return new ActionFieldDate<TypingsSchema>(fieldName, this.fieldsFormStates);
  }

  getEnumField(fieldName: string): ActionFieldEnum<TypingsSchema> {
    return new ActionFieldEnum<TypingsSchema>(fieldName, this.fieldsFormStates);
  }

  getRadioGroupField(fieldName: string): ActionFieldRadioGroup<TypingsSchema> {
    return new ActionFieldRadioGroup<TypingsSchema>(fieldName, this.fieldsFormStates);
  }

  getLayout() {
    return new ActionLayoutRoot(this.fieldsFormStates.getLayout());
  }

  doesFieldExist(fieldName: string): boolean {
    return Boolean(this.fieldsFormStates.getField(fieldName));
  }
}
