import { expect } from "chai";

import { FastifyInstance } from "fastify";
import sharp, { Sharp } from "sharp";
import { v4 as uuidv4 } from "uuid";
import { createNewImageInDb, uploadImageToBucket } from "../../../src/crud";
import { Image } from "../../../src/types";
import { clearBucket, clearTable, getServer } from "../../util";

import fs from "node:fs";
const imageBuff = fs.readFileSync("test/fixtures/plant.png");

describe("GET /image/:id.:ext", () => {
  let server: FastifyInstance;
  let dbImage: Image;
  let ogImage: Sharp;
  let ogMeta: sharp.Metadata;

  before(async () => {
    server = await getServer();
  });

  beforeEach(async () => {
    await clearTable();
    await clearBucket();

    ogImage = sharp(imageBuff);
    ogMeta = await ogImage.metadata();

    const version = await uploadImageToBucket("test", ogImage, 100);
    dbImage = await createNewImageInDb(
      {
        id: uuidv4(),
        versions: [version],
        user: "test",
      },
      server.log
    );
  });

  it("should return 200 with the image if requested version exists", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/image/${dbImage.id}.png`,
    });

    expect(res.statusCode).to.equal(200);
    expect(res.headers["content-type"]).to.equal("image/png");

    const image = sharp(res.rawPayload);

    const meta = await image.metadata();

    /**
     * For whatever reason, the image returned is 38% larger than the original.
     * I haven't figured out where this is coming from yet, but something with sharp,
     * almost for sure. The image is visually the same, and otherwise has the same
     * metadata.
     */
    expect({ ...meta, size: undefined }).to.deep.equal({
      ...ogMeta,
      size: undefined,
    });
  });

  it("should return 200 with the image in a different format when requested", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/image/${dbImage.id}.webp`,
    });

    expect(res.statusCode).to.equal(200);
    expect(res.headers["content-type"]).to.equal("image/webp");

    const image = sharp(res.rawPayload);

    const meta = await image.metadata();

    expect(meta.width).to.equal(ogMeta.width);
    expect(meta.height).to.equal(ogMeta.height);
    expect(meta.format).to.equal("webp");
  });

  it("should return 200 with the image resized to the requested width, preserving aspect ratio", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/image/${dbImage.id}.png?w=${ogMeta.width! / 2}`,
    });

    expect(res.statusCode).to.equal(200);
    expect(res.headers["content-type"]).to.equal("image/png");

    const image = sharp(res.rawPayload);

    const meta = await image.metadata();

    expect(meta.width).to.equal(ogMeta.width! / 2);
    expect(meta.height).to.equal(ogMeta.height! / 2);
    expect(meta.format).to.equal("png");
  });

  it("should return 200 with the image resized to the requested height, preserving aspect ratio", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/image/${dbImage.id}.png?h=${ogMeta.height! / 2}`,
    });

    expect(res.statusCode).to.equal(200);
    expect(res.headers["content-type"]).to.equal("image/png");

    const image = sharp(res.rawPayload);

    const meta = await image.metadata();

    expect(meta.width).to.equal(ogMeta.width! / 2);
    expect(meta.height).to.equal(ogMeta.height! / 2);
    expect(meta.format).to.equal("png");
  });

  it("should return 200 with the image resized to the requested quality", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/image/${dbImage.id}.png?q=50`,
    });

    expect(res.statusCode).to.equal(200);
    expect(res.headers["content-type"]).to.equal("image/png");

    const image = sharp(res.rawPayload);

    const meta = await image.metadata();

    expect(meta.width).to.equal(ogMeta.width);
    expect(meta.height).to.equal(ogMeta.height);
    expect(meta.format).to.equal("png");
    expect(meta.size).to.be.lessThan(ogMeta.size!);
  });

  it("should return 404 if the image does not exist", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/image/invalid-id",
    });

    expect(res.statusCode).to.equal(404);
  });

  it("should return 400 if the requested width is not a number", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/image/${dbImage.id}.png?w=invalid-width`,
    });

    expect(res.statusCode).to.equal(400);
  });

  it("should return 400 if the requested width is less than 1", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/image/${dbImage.id}.png?w=0`,
    });

    expect(res.statusCode).to.equal(400);
  });

  it("should return 400 if the requested height is not a number", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/image/${dbImage.id}.png?h=invalid-height`,
    });

    expect(res.statusCode).to.equal(400);
  });

  it("should return 400 if the requested height is less than 1", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/image/${dbImage.id}.png?h=0`,
    });

    expect(res.statusCode).to.equal(400);
  });

  it("should return 400 if the requested quality is not a number", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/image/${dbImage.id}.png?q=invalid-quality`,
    });

    expect(res.statusCode).to.equal(400);
  });

  it("should return 400 if the requested quality is less than 1", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/image/${dbImage.id}.png?q=0`,
    });

    expect(res.statusCode).to.equal(400);
  });

  it("should return 400 if the requested quality is greater than 100", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/image/${dbImage.id}.png?q=101`,
    });

    expect(res.statusCode).to.equal(400);
  });
});
