# set-origin

The `forest set-origin` command enables you to change the origin of a branch.

```
$ forest push --help
Set an environment as your branch's origin. Your branch will build on top of that environment's layout.

USAGE
  $ forest set-origin [ENVIRONMENT_NAME]

ARGUMENTS
  ENVIRONMENT_NAME  The environment to set as origin.

OPTIONS
  --help                         Display usage information.
```

The layout of your branch will be refreshed based on the new origin.

{% hint style="info" %}
Your current layout changes will be applied - if relevant - on top of your new origin.
{% endhint %}
