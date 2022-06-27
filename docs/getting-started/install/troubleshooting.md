## Cross-Origin Resource Sharing (CORS)

This is the most common issue you can encounter while setting up the Forest Admin Agent.
Opening the Developer Console of your browser will help to detect this kind of issue. As Forest Admin provide a complete middleware, please make sure:

- That the Forest Admin Agent is mounted before any other middleware (Especially true in a NestJS context, as the Nest App Factory allow to configure CORS on creation).
- That your server is up and running. This can be easily checked by using the `/forest` endpoint.

## Help us get better!

Finally, when your local server is started, you should be automatically redirected to a satisfaction form. Rate us so we can improve, then go to your newly created admin panel

{% hint style="info" %}

If you installed Forest Admin on a local environment, your admin backend will most likely run on an HTTP endpoint.

This explains why, if you try to visit https://app.forestadmin.com, you will be redirected to http://app.forestadmin.com as this is the only way it can communicate with your local admin backend.

Deploying your project to production will enforce HTTPS.

{% endhint %}

#### ❓ Don't you see an answer to your problem?

Describe it on our [Developer Community Forum](https://community.forestadmin.com) and we will answer quickly.
