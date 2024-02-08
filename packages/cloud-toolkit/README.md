This package needs to be installed to bootstrap and publish your cloud customizations.
It is used as a dev-dependency of the cloud-customizer

# Setup in development

_We suppose that you have already bootstrapped your project with lerna._

Run the following command to bootstrap the cloud toolkit in your project:

```bash
FOREST_SERVER_URL=https://api.development.forestadmin.com NODE_TLS_REJECT_UNAUTHORIZED=0 ./dist/command.js bootstrap -e your-sercret-key
```

Now, you have a new folder called `cloud-customizer`.
Go to the `cloud-customizer` package and install dependencies with the following command:

```bash
cd cloud-customizer
yarn install
```

Add the following environment variables to your `.env` file in the cloud-customizer::

```bash
FOREST_SERVER_URL=https://api.development.forestadmin.com
FOREST_SUBSCRIPTION_URL=wss://api.development.forestadmin.com/subscriptions
NODE_TLS_REJECT_UNAUTHORIZED=0
```

Link the `cloud-customizer` to the `cloud-toolkit` with the following command:

```bash
cd ..
yarn link
cd cloud-customizer
yarn link "@forestadmin/cloud-toolkit"
```

Now, you are able to run any command from the cloud-customizer package.
Run the following command to see the available commands:

```bash
yarn forest-cloud --help
```