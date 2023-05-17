# image-service
A service for managing images in dreamup.ai. It provides a REST API for uploading and downloading images, and supports features such as on-the-fly reformating and resizing. It also acts as a read-through cache for web images, in order to reduce the load on upstream (often public) image servers.

## Docs

This service self-hosts swagger docs at `/docs`

## Requirements
- Node 18
- NVM (recommended)
- Docker, including Compose

## Installation

```shell
# if using nvm
nvm use

# install dependencies
npm install
```

## Running Tests

```shell
# run the dependency containers
docker compose -f dependencies.yml up --detach

# run the tests
npm test
```

Running the tests will also create a directory of test images in the root of the project. It is recommended to visually inspect these images as part of the testing process.

## Run Locally

This project uses `dotenv` to read environment files. Multi-environment setups are supported via the environment variable `APP_ENV`. On start, the server will load `.env.${APP_ENV}`. The `start` script and the `user-service.yml` file both assume `APP_ENV=local`, so you will need to create a file in the root of the directory called `.env.local`. For most purposes, copying `.env.test` should be sufficient. The `.gitignore` contains a rule to ignore `.env*.local` files.

### Running the Service Locally

```shell
# run the dependency containers
docker compose -f dependencies.yml up --detach

# build the service
npm run build

# initialize local aws resources
npm run init-local

# run the service
npm start
```

#### Run with docker

```shell
npm run compose-up

# OR

./scripts/up

# Down everything with

npm run compose-down

# OR

./scripts/down
```

You can pass any arguments supported by `docker compose up` and `docker compose down` when using the `up` and `down` scripts, respectively.

## Configuration

**UNDER CONSTRUCTION**

Check `src/config.ts` in the mean time.