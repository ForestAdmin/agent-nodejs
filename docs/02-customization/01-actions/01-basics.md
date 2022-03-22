# Actions

Visualizing data is great, but at some point you're going to want to interact with it.

## What is an action?

An action is a button that triggers server-side business logic through an API call. Without a single line of code, Forest Admin natively supports all common actions required on an admin interface such as CRUD (Create, Read, Update, Delete), sort, search, data export, and more.

Actions are your own business-related actions, built with your own code. You'll learn how to use them in the following page.

| :warning: | FIXME: Add link |
| --------- | :-------------- |

## Triggering different types of actions

Triggering an action is very simple, but the behavior can differ according to the type of action.

There are 3 types of actions :

- **Bulk** actions: the action will be available when you click on one or several desired records
- **Single** actions: the action is only available for one selected record at a time
- **Global** actions: the action is always available and will be executed on all records

## Creating a simple action

In order to create a action, you will first need to **declare it in your code** for a specific collection.

Here we declare a "Mark as Live" **single** action for the companies collection, that will display a toastr containing "Company is now live!" when triggered.

```javascript
   .collection('companies', companiesCollection =>
    companiesCollection.registerAction('Mark as live', {
        scope: ActionScope.Single,
        execute: async (context, responseBuilder) => {
          // Your business logic goes here
          return responseBuilder.success(
            'Company is now live!',
          );
        },
      })
   );
```

## Context

### Single action context

### Bulk action context

### Global action context

## Response builder

### Customizing response

### Downloading a file

### Setting up a webhook

### Refreshing your related data

### Redirecting to a different page on success

### Enable/Disable an action according to the state of a record

#### Get selected records with bulk action
