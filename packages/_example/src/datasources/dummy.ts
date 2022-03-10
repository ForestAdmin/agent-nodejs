import { DataSource } from '@forestadmin/datasource-toolkit';
import makeDummyDataSource from '@forestadmin/datasource-dummy';

export default (): DataSource => makeDummyDataSource();
