# ForestAdmin Example Agent - @forestadmin/_example

## Introduction

This package serves as an example agent for Forest Admin. Its purpose is to demonstrate and test the agent's features and facilitate debugging across the entire project.

## Setup Instructions

1. **Clone and Install Dependencies**

   Clone the whole repository and navigate into the `agent-nodejs` directory. Run the following commands to install all dependencies and auto-link all packages:

    ```bash
    yarn && yarn bootstrap
    ```
    
    Start building the project and watch for changes:

    ```bash
    yarn build:watch
    ```

   Then, navigate to the `_example` directory:
   
    ```bash
    cd packages/_example
    ```

2. **Setup and Seed Databases**

   The agent utilizes multiple databases. You can conveniently spin up all the required databases in Docker containers using:

    ```bash
    docker compose up -d
    ```
   And seed the databases with:

    ```bash
    yarn db:seed
    ```

3. **Configure the Agent**

   Create a copy of the `.env.example` file and rename it to `.env`. Configure the agent by providing necessary credentials in the `.env` file.

## Running the Agent

To start the development server, run the following command:

```bash
yarn start
```

## Running the Agent with the Workflow Executor

`start:with-executor` launches both the agent and the workflow executor side-by-side using `concurrently`. The executor waits for the agent to be ready before starting.

### 1. Start the executor's Postgres database

```bash
yarn db:executor:up
```

Starts a dedicated Postgres container on `localhost:5452` (separate from the agent databases).

### 2. Add executor variables to `.env`

The script sources the `_example` `.env` file and maps two variables to the executor's expected names. Add these to your `.env`:

```dotenv
# Workflow executor
EXECUTOR_AGENT_URL=http://localhost:3310   # must match the port your agent listens on
EXECUTOR_DATABASE_URL=postgres://executor:password@localhost:5452/workflow_executor
```

`FOREST_ENV_SECRET` and `FOREST_AUTH_SECRET` are already required by the agent and are reused by the executor automatically.

### 3. Install `tsx` (if not already available)

The executor CLI uses `tsx` for fast TypeScript execution without a build step:

```bash
npm install -g tsx
```

### 4. Start both processes

```bash
yarn start:with-executor
```

Expected output (two prefixed streams):

```
[agent]    Forest Admin agent listening on port 3310
[executor] [forest-workflow-executor] Starting (database mode)
[executor] [forest-workflow-executor] Ready on http://localhost:3400
[executor] {"message":"Poll cycle completed","fetched":0,"dispatching":0}
```

### Teardown

```bash
yarn db:executor:down   # stop the executor DB container
```
