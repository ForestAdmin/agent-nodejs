import prepareGenericDatasource from './generic';

export default async () =>
  prepareGenericDatasource('mssql://sa:yourStrong(!)Password@localhost:1433/example');
