import {
  ForestServerActionFormElementFieldReference,
  ForestServerActionFormLayoutElement,
} from '@forestadmin/forestadmin-client';

import ActionLayoutInput from './action-layout-input';
import { NotFoundElementError, NotRightElementError } from './errors';

export default class ActionLayoutElement {
  protected readonly layoutItem: ForestServerActionFormLayoutElement;

  constructor(layoutItem: ForestServerActionFormLayoutElement) {
    this.layoutItem = layoutItem;
  }

  getHtmlBlockContent() {
    if (!this.isHTMLBlock()) {
      throw new NotRightElementError('an htmlBlock', this.layoutItem);
    }

    return (this.layoutItem as { content: string }).content;
  }

  getInputId(): string {
    if (!this.isInput()) {
      throw new NotRightElementError('an input', this.layoutItem);
    }

    return new ActionLayoutInput(
      this.layoutItem as ForestServerActionFormElementFieldReference,
    ).getInputId();
  }

  rowElement(n: number) {
    if (!this.isRow) {
      throw new NotRightElementError('a row', this.layoutItem);
    }

    const { fields } = this.layoutItem as { fields: ForestServerActionFormElementFieldReference[] };
    if (n < 0 || n >= fields.length) throw new NotFoundElementError(0);

    return new ActionLayoutInput(fields[n]);
  }

  isRow() {
    return this.layoutItem?.component === 'row';
  }

  isInput() {
    return this.layoutItem?.component === 'input';
  }

  isHTMLBlock() {
    return this.layoutItem?.component === 'htmlBlock';
  }

  isSeparator() {
    return this.layoutItem?.component === 'separator';
  }
}
