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

## Running the Service Locally

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

## Configuration

**UNDER CONSTRUCTION**

Check `src/config.ts` in the mean time.