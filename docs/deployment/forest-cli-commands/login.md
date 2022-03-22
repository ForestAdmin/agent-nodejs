# login

The `forest login` command allows you to authenticate using:

* your Forest Admin _email address_
* your Forest Admin _password_

```
$ forest login --help
Sign in with an existing account.

USAGE
  $ forest login

OPTIONS
  -P, --password=password  Your Forest Admin account password (ignored if token is set).
  -e, --email=email        Your Forest Admin account email.
  -t, --token=token        Your Forest Admin account token (replaces password).
```

The `--token` option refers to **application tokens** that you can create from your _Account settings_, accessible from the top right dropdown.

{% hint style="info" %}
Note that you can use `forest logout` to log out.
{% endhint %}
