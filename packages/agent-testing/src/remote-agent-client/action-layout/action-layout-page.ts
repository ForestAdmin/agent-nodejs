import { ForestServerActionFormLayoutElement } from '@forestadmin/forestadmin-client';

import ActionLayoutElementsContainer from './action-layout-container';
import { NotRightElementError } from './errors';

export default class ActionLayoutPage extends ActionLayoutElementsContainer {
  readonly nextButtonLabel: string;
  readonly previousButtonLabel: string;

  constructor(layout: ForestServerActionFormLayoutElement) {
    if (layout.component !== 'page') throw new NotRightElementError('a page', layout);

    super(layout.elements);
    this.nextButtonLabel = layout.nextButtonLabel;
    this.previousButtonLabel = layout.previousButtonLabel;
  }
}
