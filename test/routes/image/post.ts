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
  let fetchStub: sinon.SinonStub;
  const notAnImgUrl = "https://example.com";

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
    fetchStub = sandbox.stub(global, "fetch");
    fetchStub.withArgs(ogUrl).resolves(new Response(await ogImage.toBuffer()));
    fetchStub.withArgs(notAnImgUrl).resolves(new Response("Not an image"));
    fetchStub.resolves(new Response("Not found", { status: 404 }));
    image = undefined;
    url = undefined;
  });

  it("returns 201 with the image id with an internal request and a url, if not already cached", async () => {
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

  it("returns 201 with the image id with a user request and a url, if not already cached", async () => {
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

  it("returns 201 with the image id with an internal request and an image upload", async () => {
    const imgB64 = imageBuff.toString("base64");
    const response = await server.inject({
      method: "POST",
      url: "/image",
      payload: {
        image: imgB64,
      },
      headers: {
        [config.webhooks.signatureHeader]: sign(
          JSON.stringify({ image: imgB64 })
        ),
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

  it("returns 201 with the image id with a user request and an image upload", async () => {
    const imgB64 = imageBuff.toString("base64");
    const response = await server.inject({
      method: "POST",
      url: "/image",
      payload: {
        image: imgB64,
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

  it("returns 304 with the image id with an internal request and a url, if already cached and force is not specified", async () => {
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

    const originalImageId = response.json().id;

    // Now if we request the same image again, we should get a 304
    const response2 = await server.inject({
      method: "POST",
      url: "/image",
      payload: {
        url: ogUrl,
      },
      headers: {
        [config.webhooks.signatureHeader]: sign(JSON.stringify({ url: ogUrl })),
      },
    });

    expect(response2.statusCode).to.equal(304);
    expect(response2.json()).to.have.property("id");

    const imageId = response2.json().id;
    expect(imageId).to.equal(originalImageId);
  });

  it("returns 304 with the image id with a user request and a url, if already cached and force is not specified", async () => {
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

    const originalImageId = response.json().id;

    // Now if we request the same image again, we should get a 304
    const response2 = await server.inject({
      method: "POST",
      url: "/image",
      payload: {
        url: ogUrl,
      },
      cookies: {
        [config.session.cookieName]: issueSession(testUser, "testSession"),
      },
    });

    expect(response2.statusCode).to.equal(304);
    expect(response2.json()).to.have.property("id");

    const imageId = response2.json().id;
    expect(imageId).to.equal(originalImageId);
  });

  it("returns 400 if the url is invalid", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/image",
      payload: {
        url: "invalid",
      },
      headers: {
        [config.webhooks.signatureHeader]: sign(
          JSON.stringify({ url: "invalid" })
        ),
      },
    });

    expect(response.statusCode).to.equal(400);
  });

  it("returns 400 if the url is not an image", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/image",
      payload: {
        url: notAnImgUrl,
      },
      headers: {
        [config.webhooks.signatureHeader]: sign(
          JSON.stringify({ url: notAnImgUrl })
        ),
      },
    });

    expect(response.statusCode).to.equal(400);
  });

  it("returns 400 if an uploaded image is invalid", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/image",
      payload: {
        image: "invalid",
      },
      headers: {
        [config.webhooks.signatureHeader]: sign(
          JSON.stringify({ image: "invalid" })
        ),
      },
    });

    expect(response.statusCode).to.equal(400);
  });

  it("returns 413 if an uploaded image is too large", async () => {
    const tooBigBuff = fs.readFileSync("test/fixtures/too-big.png");
    const tooBigPayload = tooBigBuff.toString("base64");

    const response = await server.inject({
      method: "POST",
      url: "/image",
      payload: {
        image: tooBigPayload,
      },
      headers: {
        [config.webhooks.signatureHeader]: sign(
          JSON.stringify({ image: tooBigPayload })
        ),
      },
    });

    expect(response.statusCode).to.equal(413);
  });

  it("returns 404 if the url returns a 404", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/image",
      payload: {
        url: "https://fakeurl.com/404",
      },
      headers: {
        [config.webhooks.signatureHeader]: sign(
          JSON.stringify({ url: "https://fakeurl.com/404" })
        ),
      },
    });

    expect(response.statusCode).to.equal(404);
  });
});
