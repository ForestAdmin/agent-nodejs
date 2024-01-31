# Development Setup

### Do a cloud setup (see forestadmin-server/fullhosted-setup.md)

  - ngrok: http 3001 (server) & tcp 5435 (database)
  - edit .env of forestadmin-server & forestadmin
  - start forestadmin-server, forestadmin, & forestadmin-hosted-gateway

### Bootstrap the code customization template
  
  - Onboard on a cloud project (need a database, you can use supabase)
  - Go to the agent-nodejs repository ([clone it](https://github.com/ForestAdmin/agent-nodejs) if you haven't yet)
  - `yarn build`
  - `cd packages/cloud-toolkit`
  - Copy/paste the content of .env.example in a new .env
  - Copy in your clipboard the environment secret of your cloud project
  - `node ./dist/command.js bootstrap --env-secret <your-secret-key>`
  - (known bug: re-execute the same command if it failed)
  - Copy/paste the content of the .env from cloud-toolkit to the .env of cloud-toolkit/cloud-customizer
  - `cd cloud-customizer`
  - `yarn`
  - in package.json, replace "cloud-toolkit" with "../dist/command.js"

The cloud-customizer folder is the folder that end-users will use to write their customizations.
After this setup you can use it as any end-user.

See the README.md of cloud-customizer for its usage.