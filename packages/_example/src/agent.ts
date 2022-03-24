import Agent, { AgentOptions } from '@forestadmin/agent';
import customizePersons from './customizations/persons';
import customizeUsers from './customizations/users';
import prepareDummyDataSource from './datasources/dummy';
import prepareLiveDataSource from './datasources/live';
import prepareMssqlDataSource from './datasources/sequelize/mssql';
import prepareMysqlDataSource from './datasources/sequelize/mysql';
import preparePostgresDataSource from './datasources/sequelize/postgres';

export default async function makeAgent(options: AgentOptions) {
  return new Agent(options)
    .addDatasource(await prepareDummyDataSource())
    .addDatasource(await prepareLiveDataSource())
    .addDatasource(await prepareMssqlDataSource())
    .addDatasource(await prepareMysqlDataSource())
    .addDatasource(await preparePostgresDataSource())

    .customizeCollection('persons', customizePersons)
    .customizeCollection('user', customizeUsers)

    .customizeCollection('mysqlCity', collection => {
      collection.implementWrite('city', async patch => {
        return {
          mysqlCountry: { country: `${patch}-edited`, mysqlPresident: { president: patch } },
          countryId: 101,
          city: 'lignan',
        };
      });
    })
    .customizeCollection('mysqlPresident', collection => {
      collection.implementWrite('president', async patch => {
        return { president: `${patch}-MONSTER-modified` };
      });
    });
}
