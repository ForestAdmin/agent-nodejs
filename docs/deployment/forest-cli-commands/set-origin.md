# set-origin

The `forest set-origin` command enables you change the origin of a branch.

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

The layout of your branch will be refresh based on the new origin.

{% hint style="inof" %}
Your actual layout changes will be applied, if they can, on front of your new origin.
{% endhint %}
