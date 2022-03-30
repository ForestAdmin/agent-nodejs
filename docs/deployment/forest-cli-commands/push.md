# push

The `forest push` command enables you to apply your local changes to a remote **non-production** environment: for instance, pushing to your staging environment will result in your latest local layout changes being visible on your staging.

```
$ forest push --help
Push layout changes of your current branch to a remote environment.

USAGE
  $ forest push

OPTIONS
  -e, --environment=environment  The remote environment name to push onto.
  --force                        Skip push changes confirmation.
  --help                         Display usage information.
  --projectId=projectId          The id of the project to work on.
```

### Pushing to a remote environment

It is paramount to understand this command before using it:

![](<../../assets/imported/image (427).png>)

Pushing a branch to a remote means applying your latest layout changes to your origin environment. In the above figure, your layout changes (Δ) will be moved from `my-branch` to `Staging`.

{% hint style="warning" %}
Pushing your changes from your local branch will automatically **delete** it.\
\
If you need to work some more on on those changes but have already pushed them to a remote, you can always [make changes directly from the remote](../deploying-your-changes.md#making-changes-directly-from-the-remote).
{% endhint %}

To push to a remote environment, either provide an environment name using the `-e` option:

```
$ forest push -e Staging
```

or omit the argument: you will then be prompted to easily select among your remote environments:

```
$ forest push
[? Select the remote environment you want to push onto:
Remote1
Remote2
```

You will be prompted for confirmation before pushing to a remote:

```
$ forest push -e Remote2
[? Push branch my-current-branch onto Remote2 (Y|n): Y
```

{% hint style="info" %}
To skip that confirmation, use the `--force` option.
{% endhint %}

### Difference between forest push and forest deploy

{% hint style="danger" %}
Don't confuse `forest push` and `forest deploy`
{% endhint %}

- `forest push` applies your latest layout changes to a non-production environment (i.e a "remote")
- `forest deploy` applies your latest layout changes to your origin environment **definitively**

{% hint style="info" %}
You cannot `push` to production, because anything added on Production should be definitive. Therefore you can only `deploy` to Production.
{% endhint %}
