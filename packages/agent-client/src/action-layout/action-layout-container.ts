import { ForestServerActionFormLayoutElement } from '@forestadmin/forestadmin-client';

import ActionLayoutElement from './action-layout-element';
import { NotFoundElementError, NotRightElementError } from './errors';

export default abstract class ActionLayoutElementsContainer {
  protected readonly layout: ForestServerActionFormLayoutElement[];

  constructor(layout: ForestServerActionFormLayoutElement[]) {
    this.layout = layout;
  }

  element(n: number) {
    if (n < 0 || n >= this.layout.length) throw new NotFoundElementError(n);
    if (this.isPage(n)) throw new NotRightElementError('an element', this.layout[n]);

    return new ActionLayoutElement(this.layout[n]);
  }

  isPage(n: number) {
    return this.layout[n]?.component === 'page';
  }
}
