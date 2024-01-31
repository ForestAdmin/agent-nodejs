This package needs to be installed to bootstrap and publish your cloud customizations.
It is used as a dev-dependency of the cloud-customizer

# available commands

## bootstrap

**Mandatory option:** `-e, --env-secret <environment-secret-key>`

- Login to forestadmin
- Creates a new folder "cloud-customizer"
- Setup .env file with FOREST_ENV_SECRET and authentication token
- Generate typings from your database

## update-typings

Generate typings from the structure of the database and the code customizations.

## login

Ask user to authenticate and refresh the authentication token.