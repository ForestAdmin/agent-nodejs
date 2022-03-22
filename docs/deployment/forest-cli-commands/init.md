# init

The `forest init` command provides an all-in-one initialisation command that will:

* allow you to log in if you haven't already done so with [forest login](login.md)
* set up your own development environment on a given project.

```
$ forest init --help
Set up your development environment in your current folder.

USAGE
  $ forest init

OPTIONS
  -p, --projectId=projectId  The id of the project you want to init.
```

{% hint style="danger" %}
`forest init` is not meant to help you create a new project. If you don't have an existing project yet, please refer to [this guide](../../../../getting-started/setup-guide.md).
{% endhint %}

{% hint style="info" %}
`forest init` should be run from your project's root directory
{% endhint %}

#### Login

All Forest CLI commands require to be **authenticated**. You can do this on the fly using `forest init` or use `forest login` first. Refer to the [forest login](login.md) page if you need further details.

#### Project selection

The development environment you will initialize is _unique per project and per developer_. It is thus mandatory that we identify the right project to create your environment accordingly:

If you have **1** project only in your Forest Admin account, this step will be automatically skipped.

If you have **2** projects or more, you'll be asked to choose one: it should **match the project from your current directory!**

{% hint style="warning" %}
`forest init` requires your project to run on the latest version of Forest Admin:

```
$ forest init
✓ Selecting your project
✖ Analyzing your setup
> This project does not support branches yet. Please migrate your environments from your Project settings first.
```

If you're seeing the above message, please refer to this [migration guide](../../../../how-tos/maintain/migrate-to-the-new-development-workflow.md).
{% endhint %}

#### Endpoint selection

If you're using `forest init`, it means your admin backend should already be running **locally**. If you used the default values used during installation, your endpoint should be _http://localhost:3310_&#x20;

Since we need to know your project's local endpoint in order to create your development environment, we've left the same default values. You can just hit "Enter" to use those; otherwise simply fill the _host_ and _port_ to fit your situation.

```
[? Enter your local admin backend host: (localhost) localhost
[? Enter your local admin backend port: (3310)
```

{% hint style="success" %}
At this point, your **development environment** will be **created**! 🎉
{% endhint %}

{% hint style="info" %}
Note that your new development environnment is identified by the `FOREST_ENV_SECRET` in your `.env` file. If you had no such file, it will have been automatically created.
{% endhint %}

#### (Optional) Connecting your database

To work properly in your local environment, your Forest Admin project needs to be connected to the corresponding database (which could be local or remote, it's your choice.)

As a result, we've added an extra step to the `forest init` command to help you set up your database. If you accept the help, you'll be taken through a few prompts and your `DATABASE_URL` (and potentially [other environment variables](../../../../getting-started/setup-guide.md#available-installation-options-for-the-above-step)) will be generated and added to your `.env` file.
