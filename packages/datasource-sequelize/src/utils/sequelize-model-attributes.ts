/* eslint-disable @typescript-eslint/no-explicit-any */
import { Model, ModelAttributeColumnOptions, ModelDefined } from 'sequelize/types';

export default class SequelizeModelAttributes {
  /**
   * Sequelize 6.12 introduced a new getAttributes() function, which is
   * a getter on rawAttributes. As we want to support >=6.2 versions, this
   * code is mandatory to check the existence of getAttributes.
   */
  static getAttributes(model: ModelDefined<any, any>): {
    [attribute: string]: ModelAttributeColumnOptions<Model<any, any>>;
  } {
    return model.getAttributes ? model.getAttributes() : model.rawAttributes;
  }
}
