// import { Image } from "../../../src/types";

import sinon from "sinon";

import { expect } from "chai";
import { FastifyInstance } from "fastify";
import fs from "node:fs";
import sharp, { Sharp } from "sharp";
import config from "../../../src/config";
import {
  clearBucket,
  clearTable,
  getServer,
  issueSession,
  sign,
} from "../../util";
const imageBuff = fs.readFileSync("test/fixtures/plant.png");

const testUser = "test-user";

const sandbox = sinon.createSandbox();

describe("POST /image", () => {
  let server: FastifyInstance;
  let ogImage: Sharp;
  let ogMeta: sharp.Metadata;
  let image: Sharp | undefined;
  let url: string | undefined;
  let ogUrl = "https://example.com/image.png";

  before(async () => {
    server = await getServer();
    ogImage = sharp(imageBuff);
    ogMeta = await ogImage.metadata();
  });

  beforeEach(async () => {
    // await clearTable();
    await clearBucket();
    await clearTable();
    sandbox.restore();
    let fetchStub = sandbox.stub(global, "fetch");
    fetchStub.withArgs(ogUrl).resolves(new Response(await ogImage.toBuffer()));
    fetchStub.resolves(new Response("Not found", { status: 404 }));
    image = undefined;
    url = undefined;
  });

  it("should return 201 with the image id with an internal request and a url, if not already cached", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/image",
      payload: {
        url: ogUrl,
      },
      headers: {
        [config.webhooks.signatureHeader]: sign(JSON.stringify({ url: ogUrl })),
      },
    });

    expect(response.statusCode).to.equal(201);
    expect(response.json()).to.have.property("id");

    const imageId = response.json().id;

    // Now we can fetch that image in any format we want
    const getUrl = `/image/${imageId}.webp`;
    const imageResponse = await server.inject({
      method: "GET",
      url: getUrl,
      headers: {
        [config.webhooks.signatureHeader]: sign(
          JSON.stringify({ url: getUrl })
        ),
      },
    });

    expect(imageResponse.statusCode).to.equal(200);
    expect(imageResponse.headers["content-type"]).to.equal("image/webp");

    const image = sharp(imageResponse.rawPayload);
    const meta = await image.metadata();

    expect(meta.width).to.equal(ogMeta.width);
    expect(meta.height).to.equal(ogMeta.height);
  });

  it("should return 201 with the image id with a user request and a url, if not already cached", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/image",
      payload: {
        url: ogUrl,
      },
      cookies: {
        [config.session.cookieName]: issueSession(testUser, "testSession"),
      },
    });

    expect(response.statusCode).to.equal(201);
    expect(response.json()).to.have.property("id");

    const imageId = response.json().id;

    // Now we can fetch that image in any format we want
    const getUrl = `/image/${imageId}.webp`;
    const imageResponse = await server.inject({
      method: "GET",
      url: getUrl,
      cookies: {
        [config.session.cookieName]: issueSession(testUser, "testSession"),
      },
    });

    expect(imageResponse.statusCode).to.equal(200);
    expect(imageResponse.headers["content-type"]).to.equal("image/webp");

    const image = sharp(imageResponse.rawPayload);
    const meta = await image.metadata();

    expect(meta.width).to.equal(ogMeta.width);
    expect(meta.height).to.equal(ogMeta.height);
  });

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
