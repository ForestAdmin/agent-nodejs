import Collection from '../implementations/collection/collection';
import FieldValidator from './field';

export default class ProjectionValidator {
  static validate(collection: Collection, projection: string[]): void {
    projection.forEach(field => FieldValidator.validate(collection, field));
  }
}
