---
description: >-
  The goal of this tutorial is to help people deploy their admin backend to
  Ubuntu server.
---

# Deploy your admin backend to Ubuntu server

### Connect to your Ubuntu server using SSH

Before starting anything, you have to make sure you're able to connect to your server using SSH.

{% tabs %}
{% tab title="Command line" %}

```bash
ssh -i ~/.ssh/aws.pem ubuntu@ec2-18-204-18-81.compute-1.amazonaws.com
```

{% endtab %}

{% tab title="Output" %}

```
Warning: Permanently added 'ec2-18-204-18-81.compute-1.amazonaws.com,18.204.18.81' (ECDSA) to the list of known hosts.
Welcome to Ubuntu 18.04.1 LTS (GNU/Linux 4.15.0-1021-aws x86_64)
...
ubuntu@ip-172-31-83-152:~$
```

{% endtab %}
{% endtabs %}

### Copy the code of your admin backend to your remote server

There are many ways to copy the code of your admin backend to a remote server. For example, you can use `rsync` command, or use a versioning system like `git`.

{% hint style="warning" %}
We **strongly advise** to version the code of your admin backend using **git** and host it to a **private repository** on Github, Bitbucket, Gitlab or other providers.
{% endhint %}

#### rsync

> **rsync** is a utility for efficiently transferring and synchronizing files across computer systems, by checking the timestamp and size of files. It is _commonly_ found on Unix-like systems and functions as both a file synchronization and file transfer program.
>
> Rsync is typically used for synchronizing files and directories between two different systems.\
> (source: [wikipedia](https://en.wikipedia.org/wiki/Rsync))

The syntax used is `rsync OPTIONS SOURCE TARGET`.

```bash
rsync -avz -e "ssh -i ~/.ssh/aws.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null" --exclude=node_modules --exclude=.git --progress QuickStart ubuntu@ec2-18-204-18-81.compute-1.amazonaws.com:~/
```

In the example above, we use a SSH connection to transfer the file and we connect to the remote server using an identity_file (a private key).

| Option            | Description                            |
| ----------------- | -------------------------------------- |
| -a                | archive mode; same as -rlptgoD (no -H) |
| -v                | increase verbosity                     |
| -z                | compress file data during the transfer |
| -e                | specify the remote shell to use        |
| --exclude=PATTERN | exclude files matching PATTERN         |
| --progress        | show progress during transfer          |

Once done, you can find the code of your admin backend on the home directory of your remote server.

{% tabs %}
{% tab title="Command line" %}

```bash
ssh -i ~/.ssh/aws.pem ubuntu@ec2-18-204-18-81.compute-1.amazonaws.com
ubuntu@ip-172-31-83-152:~$ cd Quickstart/
ubuntu@ip-172-31-83-152:~/QuickStart$ ls -l
```

{% endtab %}

{% tab title="Output" %}

```bash
total 5116
-rw-r--r-- 1 ubuntu ubuntu    1386 Oct 22 08:11 app.js
-r-------- 1 ubuntu ubuntu    1692 Oct 23 12:51 aws.pem
drwxr-xr-x 2 ubuntu ubuntu    4096 Oct 12 10:19 bin
-rw-r--r-- 1 ubuntu ubuntu 5126311 Oct 12 11:20 database.dump
drwxr-xr-x 2 ubuntu ubuntu    4096 Oct 19 11:49 forest
drwxr-xr-x 2 ubuntu ubuntu    4096 Oct 19 12:22 models
-rw-r--r-- 1 ubuntu ubuntu   69568 Oct 22 07:30 package-lock.json
-rw-r--r-- 1 ubuntu ubuntu     717 Oct 22 07:30 package.json
drwxr-xr-x 2 ubuntu ubuntu    4096 Oct 12 10:19 public
drwxr-xr-x 2 ubuntu ubuntu    4096 Oct 22 07:48 routes
drwxr-xr-x 2 ubuntu ubuntu    4096 Oct 19 11:53 serializers
drwxr-xr-x 2 ubuntu ubuntu    4096 Oct 19 11:55 services
ubuntu@ip-172-31-83-152:~/QuickStart$
```

{% endtab %}
{% endtabs %}

#### git

First, you need to initialize a git repository for the code of your admin backend. From the directory of your admin backend, simply run:

```bash
git init
```

Then, you can add all the files and create your first commit.

```bash
git add .
git commit -am "First commit"
```

Finally, you can add your git remote and push the code on your favorite platform. To do so, **first** create a new QuickStart repository on your github account. **Then** run the following command after changing `YourAccount` to your account name:

```bash
git remote add origin git@github.com:YourAccount/QuickStart.git
git push -u origin master
```

Now, you can connect to your remote server using SSH and clone the repository using the HTTPS method.

{% tabs %}
{% tab title="Command line" %}

```bash
ssh -i ~/.ssh/aws.pem ubuntu@ec2-18-204-18-81.compute-1.amazonaws.com
git clone https://github.com/YourAccount/QuickStart.git
```

{% endtab %}

{% tab title="Output" %}

```bash
Cloning into 'QuickStart'...
remote: Enumerating objects: 34, done.
remote: Counting objects: 100% (34/34), done.
remote: Compressing objects: 100% (21/21), done.
remote: Total 34 (delta 7), reused 34 (delta 7), pack-reused 0
Unpacking objects: 100% (34/34), done.
```

{% endtab %}
{% endtabs %}

That's it. Your admin backend's code is available on your remote server.

{% tabs %}
{% tab title="Command line" %}

```bash
ubuntu@ip-172-31-83-152:~$ cd QuickStart/
ubuntu@ip-172-31-83-152:~/QuickStart$ ls -l
```

{% endtab %}

{% tab title="Output" %}

```
total 5112
-rw-rw-r-- 1 ubuntu ubuntu    1386 Oct 23 13:42 app.js
drwxrwxr-x 2 ubuntu ubuntu    4096 Oct 23 13:42 bin
-rw-rw-r-- 1 ubuntu ubuntu 5126311 Oct 23 13:42 database.dump
drwxrwxr-x 2 ubuntu ubuntu    4096 Oct 23 13:42 forest
drwxrwxr-x 2 ubuntu ubuntu    4096 Oct 23 13:42 models
-rw-rw-r-- 1 ubuntu ubuntu   69568 Oct 23 13:42 package-lock.json
-rw-rw-r-- 1 ubuntu ubuntu     717 Oct 23 13:42 package.json
drwxrwxr-x 2 ubuntu ubuntu    4096 Oct 23 13:42 public
drwxrwxr-x 2 ubuntu ubuntu    4096 Oct 23 13:42 routes
drwxrwxr-x 2 ubuntu ubuntu    4096 Oct 23 13:42 serializers
drwxrwxr-x 2 ubuntu ubuntu    4096 Oct 23 13:42 services
ubuntu@ip-172-31-83-152:~/QuickStart$
```

{% endtab %}
{% endtabs %}

### Install dependencies

First, you have to make sure you have Node.js and NPM correctly installed on your server.

```bash
sudo apt update
sudo apt install nodejs npm
```

Then, you will be able to install all the dependencies listed on the package.json file.

```bash
npm install
```

### Create the database

#### PostgreSQL

{% hint style="info" %}
This step is **optional** if you already have a running database.
{% endhint %}

First, you need to install PostgreSQL:

```bash
sudo apt-get install postgresql postgresql-contrib
```

Then, you will be able to connect to the database server:

{% tabs %}
{% tab title="Command line" %}

```bash
sudo -u postgres psql
```

{% endtab %}

{% tab title="Output" %}

```bash
psql (10.5 (Ubuntu 10.5-0ubuntu0.18.04))
Type "help" for help.

postgres=
```

{% endtab %}
{% endtabs %}

Now, we can export the database from your local environment (your computer) to import it to your Ubuntu server.

For security reason, we will not allow remote connections to this database. This is why transfer the database dump to the remote server using `rsync.`

From your computer:

```bash
PGPASSWORD=secret pg_dump -h localhost -p 5416 -U forest forest_demo --no-owner --no-acl -f database.dump
rsync -avz -e "ssh -i ~/.ssh/aws.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null" --progress database.dump ubuntu@ec2-18-204-18-81.compute-1.amazonaws.com:~/
```

Then, we will create a new DB user and schema from the remote server:

```bash
sudo -u postgres psql
postgres=# CREATE USER forest WITH ENCRYPTED PASSWORD 'secret';
postgres=# CREATE DATABASE forest_demo;
postgres=# GRANT ALL PRIVILEGES ON DATABASE forest_demo TO forest;
postgres=# \q
```

And finally import the dump:

```bash
PGPASSWORD=secret psql -U forest -h 127.0.0.1 forest_demo < database.dump
```

That's it, your database is now fully imported.

{% tabs %}
{% tab title="Command line" %}

```
PGPASSWORD=secret psql -U forest -h 127.0.0.1 forest_demo
```

{% endtab %}

{% tab title="Output" %}

```bash
psql (10.5 (Ubuntu 10.5-0ubuntu0.18.04))
Type "help" for help.

forest_demo=>
```

{% endtab %}
{% endtabs %}

{% tabs %}
{% tab title="Command line" %}

```
forest_demo=> \d
```

{% endtab %}

{% tab title="Output" %}

```sql
                 List of relations
 Schema |        Name         |   Type   |  Owner
--------+---------------------+----------+----------
 public | Companies_id_seq    | sequence | postgres
 public | addresses           | table    | postgres
 public | addresses_id_seq    | sequence | postgres
 public | appointments        | table    | postgres
 public | appointments_id_seq | sequence | postgres
 public | companies           | table    | postgres
 public | customers           | table    | postgres
 public | customers_id_seq    | sequence | postgres
 public | deliveries          | table    | postgres
 public | deliveries_id_seq   | sequence | postgres
 public | documents           | table    | postgres
 public | documents_id_seq    | sequence | postgres
 public | orders              | table    | postgres
 public | orders_id_seq       | sequence | postgres
 public | products            | table    | postgres
 public | products_id_seq     | sequence | postgres
 public | transactions        | table    | postgres
 public | transactions_id_seq | sequence | postgres
(18 rows)
```

{% endtab %}
{% endtabs %}

### Export the environment variables

You must export the environment variables `FOREST_ENV_SECRET` `FOREST_AUTH_SECRET` and `DATABASE_URL`. To do so, open and edit the file `/etc/environment`:

The `FOREST_ENV_SECRET` and `FOREST_AUTH_SECRET` environment variables will be given by Forest after creating a production environment from the interface. [See how to get them here](../environments.md#deploying-to-production).

```bash
sudo vim /etc/environment
```

{% code title="/etc/environment" %}

```bash
PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games"
FOREST_ENV_SECRET=2417520743be37a9c5af198c018e0ddee9b7c41de1ccb8e76c9d027faa74059e
FOREST_AUTH_SECRET=Piq7a9Kv5anLbK4gj81rirsLhfaJ0pdL
DATABASE_URL=postgres://forest:secret@127.0.0.1/forest_demo
```

{% endcode %}

Then, you can restart your server to take these new variables into account or simply type:

```bash
for env in $( cat /etc/environment ); do export $(echo $env | sed -e 's/"//g'); done
```

### Run your admin backend

From your admin backend's directory, simply type:

{% tabs %}
{% tab title="Command line" %}

```bash
npm start
```

{% endtab %}

{% tab title="Output" %}

```
> QuickStart@0.0.1 start /home/ubuntu/QuickStart
> node ./bin/www

🌳  Your back office API is listening on port 3000  🌳
🌳  Access the UI: http://app.forestadmin.com  🌳
```

{% endtab %}
{% endtabs %}

Congrats, your admin backend is now running on production. But we strongly advise you to continue following the next steps. If you chose not to do it, you can go back to your Forest interface to create a production environment. [Check out here how to do it](../environments.md#deploying-to-production).

The admin backend is by default listening on port **3310**. Be sure you authorized the inbound traffic on this port or set up a web server (like NGINX) as a [Reverse Proxy Server](#optional-set-up-nginx-as-a-reverse-proxy-server) to use the port **80.**

### Manage Application with PM2

> PM2 is a Production Runtime and Process Manager for Node.js applications with a built-in Load Balancer. It allows you to keep applications alive forever, to reload them without downtime and facilitate common Devops tasks. source: [npmjs/pm2](https://www.npmjs.com/package/pm2)​

#### Install PM2

```bash
sudo npm install pm2 -g
```

#### Run your admin backend using PM2

```bash
pm2 start bin/www
```

### (Optional) Set Up Nginx as a Reverse Proxy Server

Now that your admin backend is running and listening on localhost:3310, we will set up the Nginx web server as a reserve proxy to allow your admin panel's users access it.

```bash
sudo apt install nginx
```

To do so, edit (with sudo access) the file located `/etc/nginx/sites-available/default` and replace the existing section `location /` by this one:

{% code title="/etc/nginx/sites-available/default" %}

```
location / {
  proxy_pass http://localhost:3000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection 'upgrade';
  proxy_set_header Host $host;
  proxy_cache_bypass $http_upgrade;
}
```

{% endcode %}

Then, restart nginx:

```bash
sudo systemctl restart nginx
```

That's it, your admin backend is now listening on the port **80**. Make sure your firewall allows inbound traffic from this port.

{% hint style="danger" %}
We now require that you configure **HTTPS** (port 443) on your admin backend service for **security reasons.** [http://nginx.org/en/docs/http/configuring_https_servers.html](http://nginx.org/en/docs/http/configuring_https_servers.html)​
{% endhint %}

{% hint style="warning" %}
Once you've completed the above steps, it does **not** mean your project is deployed to production on Forest Admin. To deploy to production, check out [this section](../environments.md#deploying-to-production).
{% endhint %}
