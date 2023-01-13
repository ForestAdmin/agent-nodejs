import FieldValidator from './field';
import { Collection } from '../interfaces/collection';

export default class ProjectionValidator {
  static validate(collection: Collection, projection: string[]): void {
    projection.forEach(field => FieldValidator.validate(collection, field));
  }
}
