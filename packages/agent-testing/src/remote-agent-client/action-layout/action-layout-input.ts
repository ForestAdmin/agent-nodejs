import { ForestServerActionFormElementFieldReference } from '@forestadmin/forestadmin-client';

export default class ActionLayoutInput {
  protected readonly layoutItem: ForestServerActionFormElementFieldReference;

  constructor(layoutItem: ForestServerActionFormElementFieldReference) {
    this.layoutItem = layoutItem;
  }

  getInputId() {
    return this.layoutItem.fieldId;
  }
}
