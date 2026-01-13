import type ActionField from '../action-fields/action-field';
import type FieldFormStates from '../action-fields/field-form-states';
import type HttpRequester from '../http-requester';

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
export default class Action {
  private readonly collectionName: string;

  private readonly httpRequester: HttpRequester;
  protected readonly fieldsFormStates: FieldFormStates;
  private readonly ids: (string | number)[];
  private actionPath: string;

  constructor(
    collectionName: string,
    httpRequester: HttpRequester,
    actionPath: string,
    fieldsFormStates: FieldFormStates,
    ids?: (string | number)[],
  ) {
    this.collectionName = collectionName;
    this.httpRequester = httpRequester;
    this.ids = ids ?? undefined;
    this.actionPath = actionPath;
    this.fieldsFormStates = fieldsFormStates;
  }

  async execute(
    signedApprovalRequest?: Record<string, unknown>,
  ): Promise<{ success: string; html?: string }> {
    const requestBody = {
      data: {
        attributes: {
          collection_name: this.collectionName,
          ids: this.ids,
          values: this.fieldsFormStates.getFieldValues(),
          signed_approval_request: signedApprovalRequest,
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

  async setFields(fields: Record<string, unknown>): Promise<void> {
    for (const [fieldName, value] of Object.entries(fields)) {
      if (!this.doesFieldExist(fieldName)) {
        throw new Error(`Field "${fieldName}" does not exist in this form`);
      }

      // eslint-disable-next-line no-await-in-loop
      await this.fieldsFormStates.setFieldValue(fieldName, value);
    }
  }

  async tryToSetFields(fields: Record<string, unknown>): Promise<string[]> {
    const skippedFields: string[] = [];

    for (const [fieldName, value] of Object.entries(fields)) {
      if (this.doesFieldExist(fieldName)) {
        // eslint-disable-next-line no-await-in-loop
        await this.fieldsFormStates.setFieldValue(fieldName, value);
      } else {
        skippedFields.push(fieldName);
      }
    }

    return skippedFields;
  }

  getFields() {
    return this.fieldsFormStates.getFields().map(f => {
      return this.getField(f.getName());
    });
  }

  getField(fieldName: string): ActionField {
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

  getFieldNumber(fieldName: string): ActionFieldNumber {
    return new ActionFieldNumber(fieldName, this.fieldsFormStates);
  }

  getFieldJson(fieldName: string): ActionFieldJson {
    return new ActionFieldJson(fieldName, this.fieldsFormStates);
  }

  getFieldNumberList(fieldName: string): ActionFieldNumberList {
    return new ActionFieldNumberList(fieldName, this.fieldsFormStates);
  }

  getFieldString(fieldName: string): ActionFieldString {
    return new ActionFieldString(fieldName, this.fieldsFormStates);
  }

  getFieldStringList(fieldName: string): ActionFieldStringList {
    return new ActionFieldStringList(fieldName, this.fieldsFormStates);
  }

  getDropdownField(fieldName: string): ActionFieldDropdown {
    return new ActionFieldDropdown(fieldName, this.fieldsFormStates);
  }

  getCheckboxField(fieldName: string): ActionFieldCheckbox {
    return new ActionFieldCheckbox(fieldName, this.fieldsFormStates);
  }

  getCheckboxGroupField(fieldName: string): ActionFieldCheckboxGroup {
    return new ActionFieldCheckboxGroup(fieldName, this.fieldsFormStates);
  }

  getColorPickerField(fieldName: string): ActionFieldColorPicker {
    return new ActionFieldColorPicker(fieldName, this.fieldsFormStates);
  }

  getDateField(fieldName: string): ActionFieldDate {
    return new ActionFieldDate(fieldName, this.fieldsFormStates);
  }

  getEnumField(fieldName: string): ActionFieldEnum {
    return new ActionFieldEnum(fieldName, this.fieldsFormStates);
  }

  getRadioGroupField(fieldName: string): ActionFieldRadioGroup {
    return new ActionFieldRadioGroup(fieldName, this.fieldsFormStates);
  }

  getLayout() {
    return new ActionLayoutRoot(this.fieldsFormStates.getLayout());
  }

  doesFieldExist(fieldName: string): boolean {
    return Boolean(this.fieldsFormStates.getField(fieldName));
  }
}
