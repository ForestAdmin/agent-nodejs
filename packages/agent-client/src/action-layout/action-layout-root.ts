import ActionLayoutElementsContainer from './action-layout-container';
import ActionLayoutPage from './action-layout-page';
import { NotFoundElementError, NotRightElementError } from './errors';

export default class ActionLayoutRoot extends ActionLayoutElementsContainer {
  page(n: number) {
    if (n < 0 || n >= this.layout.length) throw new NotFoundElementError(n);
    if (!this.isPage(n)) throw new NotRightElementError('a page', this.layout[n]);

    return new ActionLayoutPage(this.layout[n]);
  }
}
