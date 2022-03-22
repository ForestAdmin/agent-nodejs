# Using branches

As we've explained in the previous page, your Admin panel's frontend is saved on Forest Admin servers. As a result, you can't version it. But don't worry, we've got you covered with some great tools!

### What is a layout?

The notion of branch cannot be explained without first explaining what a _layout_ is.

A **layout** is all the settings that **define your user interface (UI)**. In Forest Admin, there is 1 layout per environment and per team:

![](<../assets/image (416).png>)

{% hint style="info" %}
To manipulate your layouts, you will be using [Forest CLI](forest-cli-commands/).
{% endhint %}

### What is a branch?

A branch is a fork (i.e copy) of the layout of your _origin_ environment. It is attached to your development environment.

{% hint style="info" %}
Your **origin** environment is generally your **production environment**, unless you don't have one in which case it will be one of your remote environments.
{% endhint %}

Once you've created a branch, your layout will look exactly like the layout of your origin environment. However,&#x20;

### How do branches work?

Any **layout change** you make on your current branch using the [Layout Editor](broken-reference) will be **saved on your current branch** and will not affect your origin environment.

Imagine the following situation where you have 3 environments:

![](<../assets/image (417).png>)

The branch `my-branch` is based on the production layout. Any changes made on it are saved in your branch's layout and can later be [moved ](forest-cli-commands/push.md)or [applied ](forest-cli-commands/deploy.md)to other layouts.

![](<../assets/image (418).png>)

{% hint style="warning" %}
This also means that any changes made to the origin environment (i.e production) will instantly reflect on your branch.\
\
For those familiar with git's _rebase_, this means you will **never have to** **rebase** your branch on your origin environment (i.e production).
{% endhint %}

### How do you create a branch?

To create a branch, you'll need to use [Forest CLI](forest-cli-commands/). Make sure you've created your local development environment using the [init](forest-cli-commands/init.md) command. Then, to create a branch named `my-branch`, simply run:

```
forest branch my-branch
```

{% hint style="info" %}
Using kebab-case is recommended; however, should you want to use spaces in your branch name, don't forget to surround it with quotes, like so `forest branch "my branch"`.
{% endhint %}

To learn more about the `branch` command, please visit [this page](forest-cli-commands/branch.md).

### Checking your branch information

On your interface, click on the environment dropdown at the top-left side of your screen. Select a developement environment (if you don't have one, see the [init](forest-cli-commands/init.md) command).

![](<../assets/image (419).png>)

Your **current** branch will be displayed at the top.

{% hint style="info" %}
To switch your _current_ branch to another existing branch, check out the [switch](forest-cli-commands/switch.md) command.
{% endhint %}

In the Environments dropdown, you can see the **number of changes** made on the branch/environment.

![](<../assets/image (420).png>)

Now that you've mastered branch creation and management, let's dive into the next step of the development workflow: deployment
