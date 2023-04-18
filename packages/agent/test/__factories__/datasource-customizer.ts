import { DataSourceCustomizer } from '@forestadmin/datasource-customizer';
import { Factory } from 'fishery';

export class DataSourceCustomizerFactory extends Factory<DataSourceCustomizer> {
  mockAllMethods() {
    return this.afterBuild(Customizer => {
      Customizer.addChart = jest.fn();
      Customizer.addDataSource = jest.fn();
      Customizer.customizeCollection = jest.fn();
      Customizer.getCollection = jest.fn();
      Customizer.getDataSource = jest.fn();
      Customizer.updateTypesOnFileSystem = jest.fn();
      Customizer.use = jest.fn();
    });
  }
}

const dataSourceCustomizerFactory = DataSourceCustomizerFactory.define(
  () => new DataSourceCustomizer(),
);

export default dataSourceCustomizerFactory;
