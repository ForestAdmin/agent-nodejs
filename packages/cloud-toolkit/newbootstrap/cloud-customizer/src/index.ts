import type { Agent } from '@forestadmin/cloud-toolkit';

import { Schema } from '../typings';

/*
You can find the documentation of the agent at the following URL to
help you to understand how to use the agent and how to customize your project.
=======================================================================
===== https://docs.forestadmin.com/developer-guide-agents-nodejs/ =====
=======================================================================

Run with npm or yarn this command to deploy the hello world custom field.
=======================================================================
================== forestadmin:build:package:publish ==================
=======================================================================
*/
export default function customizeAgent(agent: Agent<Schema>) {
  agent.customizeCollection('actor', collection => {
    collection.addField('HelloWorld', {
      columnType: 'String',
      defaultValue: 'Hello World',
      dependencies: ['actor_id'],
      getValues(records) {
        return records.map(() => 'Hello World');
      },
    });
  });
}
