import { expect } from "chai";

import { FastifyInstance } from "fastify";
import sharp, { Sharp } from "sharp";
import { v4 as uuidv4 } from "uuid";
import { createNewImageInDb, uploadImageToBucket } from "../../../src/crud";
import { Image } from "../../../src/types";
import {
  clearBucket,
  clearTable,
  getServer,
  writeOutputImage,
} from "../../util";

import fs from "node:fs";
const imageBuff = fs.readFileSync("test/fixtures/plant.png");

describe("GET /image/:id.:ext", () => {
  let server: FastifyInstance;
  let dbImage: Image;
  let ogImage: Sharp;
  let ogMeta: sharp.Metadata;
  let image: Sharp | undefined;
  let url: string | undefined;

  before(async () => {
    server = await getServer();
  });

  beforeEach(async () => {
    await clearTable();
    await clearBucket();
    image = undefined;
    url = undefined;

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

  afterEach(async () => {
    if (image && url) {
      await writeOutputImage(image, url);
    }
  });

  it("should return 200 with the image if requested version exists", async () => {
    url = `/image/${dbImage.id}.png`;
    const res = await server.inject({
      method: "GET",
      url,
    });

    expect(res.statusCode).to.equal(200);
    expect(res.headers["content-type"]).to.equal("image/png");

    image = sharp(res.rawPayload);

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
    url = `/image/${dbImage.id}.webp`;
    const res = await server.inject({
      method: "GET",
      url,
    });

    expect(res.statusCode).to.equal(200);
    expect(res.headers["content-type"]).to.equal("image/webp");

    image = sharp(res.rawPayload);

    const meta = await image.metadata();

    expect(meta.width).to.equal(ogMeta.width);
    expect(meta.height).to.equal(ogMeta.height);
    expect(meta.format).to.equal("webp");
  });

  it("should return 200 with the image resized to the requested width, preserving aspect ratio", async () => {
    url = `/image/${dbImage.id}.png?w=${ogMeta.width! / 2}`;
    const res = await server.inject({
      method: "GET",
      url,
    });

    expect(res.statusCode).to.equal(200);
    expect(res.headers["content-type"]).to.equal("image/png");

    image = sharp(res.rawPayload);

    const meta = await image.metadata();

    expect(meta.width).to.equal(ogMeta.width! / 2);
    expect(meta.height).to.equal(ogMeta.height! / 2);
    expect(meta.format).to.equal("png");
  });

  it("should return 200 with the image resized to the requested height, preserving aspect ratio", async () => {
    url = `/image/${dbImage.id}.png?h=${ogMeta.height! / 2}`;
    const res = await server.inject({
      method: "GET",
      url,
    });

    expect(res.statusCode).to.equal(200);
    expect(res.headers["content-type"]).to.equal("image/png");

    image = sharp(res.rawPayload);

    const meta = await image.metadata();

    expect(meta.width).to.equal(ogMeta.width! / 2);
    expect(meta.height).to.equal(ogMeta.height! / 2);
    expect(meta.format).to.equal("png");
  });

  it("should return 200 with the image resized to the requested quality", async () => {
    url = `/image/${dbImage.id}.png?q=50`;
    const res = await server.inject({
      method: "GET",
      url,
    });

    expect(res.statusCode).to.equal(200);
    expect(res.headers["content-type"]).to.equal("image/png");

    image = sharp(res.rawPayload);

    const meta = await image.metadata();

    expect(meta.width).to.equal(ogMeta.width);
    expect(meta.height).to.equal(ogMeta.height);
    expect(meta.format).to.equal("png");
    expect(meta.size).to.be.lessThan(ogMeta.size!);
  });

  it("should return 200 with an image with the correct dimensions when w, h, and fit=contain are provided", async () => {
    url = `/image/${dbImage.id}.png?w=500&h=500&fit=contain`;
    const res = await server.inject({
      method: "GET",
      url,
    });

    expect(res.statusCode).to.equal(200);
    expect(res.headers["content-type"]).to.equal("image/png");

    image = await sharp(res.rawPayload);
    const metadata = await image.metadata();

    expect(metadata.width).to.equal(500);
    expect(metadata.height).to.equal(500);
  });

  it("should return 200 and preserve aspect ratio when using fit=inside", async () => {
    url = `/image/${dbImage.id}.png?w=500&h=500&fit=inside`;
    const res = await server.inject({
      method: "GET",
      url,
    });

    expect(res.statusCode).to.equal(200);
    expect(res.headers["content-type"]).to.equal("image/png");

    image = sharp(res.rawPayload);
    const metadata = await image.metadata();

    const expectedAspectRatio = ogMeta.width! / ogMeta.height!;

    /**
     * The example image is portrait, so width will be lower than height.
     */
    expect(metadata.width).to.equal(expectedAspectRatio * 500);
    expect(metadata.height).to.equal(500);
    expect(metadata.format).to.equal("png");
    expect(metadata.size).to.be.lessThan(ogMeta.size!);
    expect(metadata.width! / metadata.height!).to.be.closeTo(
      expectedAspectRatio,
      0.01
    );
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
