import { AgentOptions, createAgent } from '@forestadmin/agent';
import { createHubspotDataSource } from '@forestadmin/datasource-hubspot';
import { createSqlDataSource } from '@forestadmin/datasource-sql';
import { flattenRelation } from '@forestadmin/plugin-flattener';
import dotenv from 'dotenv';

import { Schema } from './typings';
import { TypingsHubspot } from './typings-hubspot';

dotenv.config();

export default async () => {
  // Make and mount agent.
  const envOptions: AgentOptions = {
    authSecret: process.env.FOREST_AUTH_SECRET,
    envSecret: process.env.FOREST_ENV_SECRET,
    forestServerUrl: process.env.FOREST_SERVER_URL,
    isProduction: false,
    // loggerLevel: 'Debug',
    loggerLevel: 'Info',
    typingsPath: 'src/typings.ts',
  };

  const agent = createAgent<Schema>(envOptions);

  agent.addDataSource(createSqlDataSource({ uri: process.env.STAGING_DB, sslMode: 'preferred' }));
  agent.addDataSource(
    await createHubspotDataSource<TypingsHubspot>({
      cacheInto: 'sqlite:/tmp/mydatabase-forest-3.db',
      accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
      skipTypings: false,
      collections: {
        companies: [
          'lead_lifecycle_stage',
          'lifecycle_stage',
          'became_a_mql',
          'became_a_sql_date',
          'became_a_partner_date',
          'became_a_prospect_date',
          'became_engaged_date',
          'first_meeting_date',
          'industry',
          'hs_analytics_source',
          'name',
          'founded_year',
          'city',
          'country',
          'website',
          'numberofemployees',
          'annualrevenue',
        ],
        projects: ['original_source_type', 'cs_owner', 'project_name', 'project_id', 'mrr'],
        deals: [
          'lead_lifecycle_stage',
          'dealname',
          'amount',
          'dealstage',
          'closed_date',
          'dealtype',
          'closed_lost_reason',
          'n14_days_candidate',
          'becamea_a_14_days_onboarding_candidate_date',
          'engagements_last_meeting_booked',
          'project_id_2',
          'hs_analytics_source',
          'pipeline',
          'cs_owner',
        ],
        contacts: [
          'email',
          'lead_lifecycle_stage',
          'lifecyclestage',
          'first_conversion_date',
          'first_conversion_event_name',
          'first_customer_date',
          'first_deal_created_date',
          'first_ex_customer_date',
          'first_lead_date',
          'first_mql_date',
          'first_opportunity_date',
          'first_pql_date',
          'first_sal_date',
          'first_sql_date',
          'last_call_date',
          'last_customer_date',
          'last_deployment_flow_started_at',
          'last_ex_customer_date',
          'last_installation_started_at',
          'last_invitation_date',
          'last_lead_date',
          'last_mql_date',
          'last_opportunity_date',
          'last_pql_date',
          'last_project_created_at',
          'last_sal_date',
          'last_sql_date',
          'hs_lead_status',
          'lifecyclestage',
          'notes_last_contacted',
        ],
      },
      // 8h42
      pullDumpOnSchedule: '47 8 * * *',
      pullDeltaOnSchedule: '*/1 * * * *',
      pullDeltaMaxRecordUpToDate: 1000,
    }),
    { rename: collectionName => `hubspot_${collectionName}` },
  );

  agent.customizeCollection('projects', collection => {
    collection.addOneToOneRelation('hubspotProject', 'hubspot_projects', {
      originKeyTarget: 'id',
      originKey: 'project_id',
    });

    return collection.use(flattenRelation, {
      relationName: 'hubspotProject',
      include: ['original_source_type', 'project_name', 'project_id', 'mrr'],
      exclude: [],
      readonly: true,
    });
  });

  agent.customizeCollection('guests', collection => {
    collection.addOneToOneRelation('hubspotContact', 'hubspot_contacts', {
      originKeyTarget: 'email',
      originKey: 'email',
    });

    collection.importField('Lifecyclestage', { path: 'hubspotContact:lifecyclestage' });
  });

  agent.mountOnStandaloneServer(Number(process.env.HTTP_PORT_STANDALONE));
  await agent.start();
};
