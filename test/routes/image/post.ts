// import { Image } from "../../../src/types";

import sinon from "sinon";

import fs from "node:fs";
const imageBuff = fs.readFileSync("test/fixtures/plant.png");

const testUser = "test-user";

const sandbox = sinon.createSandbox();

describe("POST /image", () => {
  it(
    "should return 201 with the image id with an internal request and a url, if not already cached"
  );

  it(
    "should return 201 with the image id with a user request and a url, if not already cached"
  );

  it(
    "should return 201 with the image id with an internal request and an image upload"
  );

  it(
    "should return 201 with the image id with a user request and an image upload"
  );

  it(
    "should return 304 with the image id with an internal request and a url, if already cached and force is not specified"
  );

  it(
    "should return 304 with the image id with a user request and a url, if already cached and force is not specified"
  );

  it("should return 400 if the url is invalid");

  it("should return 400 if the url is not an image");

  it("should return 400 if an uploaded image is invalid");

  it("should return 400 if an uploaded image is too large");

  it("should return 404 if the url returns a 404");
});
