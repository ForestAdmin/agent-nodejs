// eslint-disable-next-line max-classes-per-file
import { ForestServerActionFormLayoutElement } from '@forestadmin/forestadmin-client';

export class NotRightElementError extends Error {
  constructor(elementName: string, element: ForestServerActionFormLayoutElement) {
    super(`This is not ${elementName}, it's a ${element.component} element`);
  }
}

export class NotFoundElementError extends Error {
  constructor(n: number) {
    super(`Element ${n} not found`);
  }
}
