# Usage

Once you created a new (cloud) project on forest admin,
you can use this package to add code customizations to it.

The workflow to add code customizations is the following:

1. [Bootstrap](#bootstrap) the code customization template to be able to write your customizations.
2. [Write your customizations](#write-your-customizations)
3. [Publish your customizations](#publish-your-customizations) to your project
4. [Update typings](#update-typings) to update typings in your IDE

# Bootstrap

`npx @forestadmin/cloud-toolkit bootstrap`

then go to the generated folder

`cd cloud-customizer`

and install the dependencies

`yarn install` or `npm install`

then build the project

`yarn build` or `npm run build`

**You can found in your `package.json` some scripts to help you to develop customizations.
You can replace them with your own scripts, by using directly the `forest-cloud` command.**

# Write your customizations

**[Read the developer guide](https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/agent-customization)** to learn how to write customizations.

# Publish your customizations

To publish your customizations, you need to build, package and publish your customizations.
The build command will compile your customizations, the package command will create a package and the publish command will publish your package to your project.

```bash
npx forest-cloud build
npx forest-cloud package
npx forest-cloud publish
```

You can also use `yarn` or `npm` and run `forestadmin:build:package:publish` script.

# Update typings

**_`build` and `build:watch` scripts will update typings automatically._**

But if you want to update typings manually, you can run:

`npx forest-cloud update-typings`

You can also use `yarn` or `npm` and run `forestadmin:update-typings` script.

This command will update typings according to the structure of your database and your current code customizations.
The typings are here to provide autocompletion in your IDE to help you write faster and avoid errors in your code.

You should execute this command on a regular basis, to keep your IDE
updated with your database structure and customizations.

# Refresh authentication token

`npx forest-cloud login`

You can also use `yarn` or `npm` and run `forestadmin:login` script.

This command triggers an authentication workflow and refresh the authentication token.

An alternative, is to add the `FOREST_AUTH_TOKEN` token in your `.env` file.
You can create one by [going to your account settings](https://app.development.forestadmin.com/user-settings/application-tokens/generate).

Then add the following line in your `.env` file:
```
FOREST_AUTH_TOKEN=your-token
```