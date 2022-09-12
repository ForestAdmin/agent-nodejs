# Deploy your admin backend on Heroku

This tutorial is designed to assist people who want to have a step-by-step guide to deploy the Lumber-generated admin backend to Heroku.

If you don’t have a Heroku account yet, [sign up here](https://signup.heroku.com/). Then, create your first Heroku application **(1)** **(2)**.

![](../../assets/deploy-on-heroku-01.png)

![](../../assets/deploy-on-heroku-02.png)

After creating your application, simply follow the Heroku guide “Deploy using Heroku Git” to push the lumber-generated admin backend code to the Heroku application.

![](../../assets/deploy-on-heroku-03.png)

Push your code using the following command:

{% tabs %}
{% tab title="Command line" %}

```bash
git push heroku master
```

{% endtab %}

{% tab title="Output" %}

```
Counting objects: 25, done.
Delta compression using up to 4 threads.
Compressing objects: 100% (20/20), done.
Writing objects: 100% (25/25), 21.56 KiB | 5.39 MiB/s, done.
Total 25 (delta 9), reused 0 (delta 0)
remote: Compressing source files... done.
remote: Building source:
remote:
remote: -----> Node.js app detected
remote:
remote: -----> Creating runtime environment
remote:
remote:        NPM_CONFIG_LOGLEVEL=error
remote:        NODE_VERBOSE=false
remote:        NODE_ENV=production
remote:        NODE_MODULES_CACHE=true
remote:
remote: -----> Installing binaries
remote:        engines.node (package.json):  unspecified
remote:        engines.npm (package.json):   unspecified (use default)
remote:
remote:        Resolving node version 8.x...
remote:        Downloading and installing node 8.11.4...
remote:        Using default npm version: 5.6.0
remote:
remote: -----> Restoring cache
remote:        Skipping cache restore (not-found)
remote:
remote: -----> Building dependencies
remote:        Installing node modules (package.json + package-lock)
remote:        added 246 packages in 7.72s
remote:
remote: -----> Caching build
remote:        Clearing previous node cache
remote:        Saving 2 cacheDirectories (default):
remote:        - node_modules
remote:        - bower_components (nothing to cache)
remote:
remote: -----> Pruning devDependencies
remote:        Skipping because npm 5.6.0 sometimes fails when running 'npm prune' due to a known issue
remote:        https://github.com/npm/npm/issues/19356
remote:
remote:        You can silence this warning by updating to at least npm 5.7.1 in your package.json
remote:        https://devcenter.heroku.com/articles/nodejs-support#specifying-an-npm-version
remote:
remote: -----> Build succeeded!
remote: -----> Discovering process types
remote:        Procfile declares types     -> (none)
remote:        Default types for buildpack -> web
remote:
remote: -----> Compressing...
remote:        Done: 24.2M
remote: -----> Launching...
remote:        Released v3
remote:        https://lumber-deploy-to-production.herokuapp.com/ deployed to Heroku
remote:
remote: Verifying deploy... done.
To https://git.heroku.com/lumber-deploy-to-production.git
 * [new branch]      master -> master
```

{% endtab %}
{% endtabs %}

{% hint style="success" %}
Your admin backend is now deployed in a remote Heroku application. 🎉
{% endhint %}

{% hint style="warning" %}
This does **not** mean your project is deployed to production on Forest Admin. To deploy to production, check out [this section](../environments.md#deploying-to-production) after you've completed the above steps.
{% endhint %}
