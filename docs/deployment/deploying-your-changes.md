# Deploying your changes

You're building a great feature which requires tweaking your layout (UI), you've used the Layout Editor and it knows looks just like you had imagined? Well now is the time to try it on a remote server!

Imagine this is your current situation:

![](../assets/dev-workflow-current-situation.png)

Your branch `my-branch` is based on your [origin ](using-branches.md#what-is-a-branch)environment (production in this case) and you have made **layout changes (Δ)** over it.

### Applying your changes to production: `deploy`

**`deploy` ** means applying your branch's changes to your origin environment definitively. To achieve this, you'll be using Forest CLI's [deploy](forest-cli-commands/deploy.md) command:

```
forest deploy my-branch
```

The end result is the following:

![](../assets/dev-workflow-end-situation.png)

{% hint style="danger" %}
Don't forget to **deploy your backend changes** as well (if any), as showcased on [this flowchart](./#development-workflow).
{% endhint %}

{% hint style="info" %}
Note how your layout changes are also applied to your remote, as it is based on production.
{% endhint %}

### Testing your changes on a remote (i.e "staging") first: `push`

**`push` ** means moving your branch's changes to a remote environment. To achieve this, you'll be using Forest CLI's [push](forest-cli-commands/push.md) command:

```
forest push
```

{% hint style="info" %}
Note that you'll be pushing your **current** branch. To select another branch, use [switch](forest-cli-commands/switch.md).
{% endhint %}

![](../assets/dev-workflow-push.png)

#### Deploying from your remote's interface

Once you have tested your new feature on "Remote 1", you can't deploy your branch's layout to "Production", since your branch will have been deleted by pushing it to "Remote 1".&#x20;

To deploy it from there, simply **click on "Deploy to production" in the top banner**!

![](../assets/dev-workflow-deploy-remote.png)

#### Making changes directly from the remote

Imagine you've pushed your branch onto your remote, but notice a slight change is still required in the layout. Then, simply use the Layout Editor from your remote! It'll play nicely with your branch's layout changes: any changes you make on your remote will also be deployed when you run `forest deploy`.

{% hint style="warning" %}
Note that creating a branch from a remote's layout (in order to rework on it) is not possible at this time, but is definitely something we're considering.

If you would like to notify us of your interest in this feature, please [submit your feedback here](https://portal.productboard.com/forestadmin/1-forest-admin-product-roadmap/c/111-forest-cli-choose-the-origin-of-your-branch).
{% endhint %}
