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

### Quick start (in-memory, no database required)

#### 1. Add executor variables to `.env`

```dotenv
# Workflow executor
EXECUTOR_AGENT_URL=http://localhost:3351  # must match the port your agent listens on
OPENAI_API_KEY=sk-...                     # or ANTHROPIC_API_KEY
```

`FOREST_ENV_SECRET` and `FOREST_AUTH_SECRET` are already required by the agent and are reused by the executor automatically.

#### 2. Install `tsx` (if not already available)

```bash
npm install -g tsx
```

#### 3. Start both processes

```bash
yarn start:with-executor:with-openai:in-memory
# or
yarn start:with-executor:with-anthropic:in-memory
```

Run state is kept in memory and lost on restart. Use this for local development and testing.

---

### Persistent mode (Postgres)

Use the database-backed scripts when you need run history to survive restarts.

#### 1. Start the executor's Postgres database

```bash
yarn db:executor:up
```

Starts a dedicated Postgres container on `localhost:5459` (separate from the agent databases).

#### 2. Add executor variables to `.env`

```dotenv
# Workflow executor
EXECUTOR_AGENT_URL=http://localhost:3351
EXECUTOR_DATABASE_URL=postgres://executor:password@localhost:5459/workflow_executor
OPENAI_API_KEY=sk-...                     # or ANTHROPIC_API_KEY
```

#### 3. Start both processes

```bash
yarn start:with-executor:with-openai
# or
yarn start:with-executor:with-anthropic
```

Expected output:

```
[agent]    Forest Admin agent listening on port 3351
[executor] [forest-workflow-executor] Starting (database mode)
[executor] [forest-workflow-executor] Ready on http://localhost:3400
[executor] {"message":"Poll cycle completed","fetched":0,"dispatching":0}
```

#### Teardown

```bash
yarn db:executor:down
```
