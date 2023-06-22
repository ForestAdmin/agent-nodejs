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

3. **Setup and Seed Databases**

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
