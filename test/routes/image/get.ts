import { expect } from "chai";

import { FastifyInstance } from "fastify";
import sharp, { Sharp } from "sharp";
import { v4 as uuidv4 } from "uuid";
import {
  createNewImageInCache,
  getKeyForImage,
  uploadImageToBucket,
} from "../../../src/crud";
// import { Image } from "../../../src/types";
import {
  clearBucket,
  clearTable,
  getServer,
  issueSession,
  writeOutputImage,
} from "../../util";

import fs from "node:fs";
const imageBuff = fs.readFileSync("test/fixtures/plant.png");

const testUser = "test-user";

describe("GET /image/:id.:ext", () => {
  let server: FastifyInstance;
  let ogImage: Sharp;
  let ogMeta: sharp.Metadata;
  let ogKey: string;
  let image: Sharp | undefined;
  let url: string | undefined;
  const publicImageId = uuidv4();

  before(async () => {
    server = await getServer();
  });

  beforeEach(async () => {
    // await clearTable();
    await clearBucket();
    await clearTable();
    image = undefined;
    url = undefined;

    ogImage = sharp(imageBuff);
    ogMeta = await ogImage.metadata();

    const params = await uploadImageToBucket(testUser, publicImageId, ogImage, {
      quality: 100,
    });
    ogKey = getKeyForImage(testUser, publicImageId, params);
    await createNewImageInCache(testUser, publicImageId, ogKey, true);
  });

  afterEach(async () => {
    if (image && url) {
      await writeOutputImage(image, url);
    }
  });

  it("should return 200 with the best version of the image if no extra params are provided", async () => {
    url = `/image/${publicImageId}.png`;
    const res = await server.inject({
      method: "GET",
      url,
    });

    expect(res.statusCode).to.equal(200);
    expect(res.headers["content-type"]).to.equal("image/png");

    image = sharp(res.rawPayload);

    const meta = await image.metadata();

    expect({
      ...meta,
      size: undefined,
      paletteBitDepth: undefined,
    }).to.deep.equal({
      ...ogMeta,
      size: undefined,
      paletteBitDepth: undefined,
    });
  });

  it("should return 200 with the image if it is requested in the same format and size", async () => {
    url = `/image/${publicImageId}.png?w=${ogMeta.width}&h=${ogMeta.height}&q=100`;
    const res = await server.inject({
      method: "GET",
      url,
    });

    expect(res.statusCode).to.equal(200);
    expect(res.headers["content-type"]).to.equal("image/png");

    image = sharp(res.rawPayload);

    const meta = await image.metadata();

    expect({
      ...meta,
      size: undefined,
      paletteBitDepth: undefined,
    }).to.deep.equal({
      ...ogMeta,
      size: undefined,
      paletteBitDepth: undefined,
    });
  });

  it("should return 200 with the image in webp when requested", async () => {
    url = `/image/${publicImageId}.webp`;
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

  it("should return 200 with the image in jpeg when requested", async () => {
    url = `/image/${publicImageId}.jpeg`;
    const res = await server.inject({
      method: "GET",
      url,
    });

    expect(res.statusCode).to.equal(200);
    expect(res.headers["content-type"]).to.equal("image/jpeg");

    image = sharp(res.rawPayload);

    const meta = await image.metadata();

    expect(meta.width).to.equal(ogMeta.width);
    expect(meta.height).to.equal(ogMeta.height);
    expect(meta.format).to.equal("jpeg");
  });

  it("should return 200 with the image in tiff when requested", async () => {
    url = `/image/${publicImageId}.tiff`;
    const res = await server.inject({
      method: "GET",
      url,
    });

    expect(res.statusCode).to.equal(200);
    expect(res.headers["content-type"]).to.equal("image/tiff");

    image = sharp(res.rawPayload);

    const meta = await image.metadata();

    expect(meta.width).to.equal(ogMeta.width);
    expect(meta.height).to.equal(ogMeta.height);
    expect(meta.format).to.equal("tiff");
  });

  it("should return 200 with the image in avif when requested", async () => {
    url = `/image/${publicImageId}.avif`;
    const res = await server.inject({
      method: "GET",
      url,
    });

    expect(res.statusCode).to.equal(200);
    expect(res.headers["content-type"]).to.equal("image/avif");

    image = sharp(res.rawPayload);

    const meta = await image.metadata();

    expect(meta.width).to.equal(ogMeta.width);
    expect(meta.height).to.equal(ogMeta.height);

    // https://github.com/lovell/sharp/issues/2504
    expect(meta.format).to.equal("heif");
  });

  it("should return 200 with the image resized to the requested width, preserving aspect ratio", async () => {
    url = `/image/${publicImageId}.png?w=${ogMeta.width! / 2}`;
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
    url = `/image/${publicImageId}.png?h=${ogMeta.height! / 2}`;
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
    url = `/image/${publicImageId}.png?q=50`;
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
    url = `/image/${publicImageId}.png?w=500&h=500&fit=contain`;
    const res = await server.inject({
      method: "GET",
      url,
    });

    expect(res.statusCode).to.equal(200);
    expect(res.headers["content-type"]).to.equal("image/png");

    image = sharp(res.rawPayload);
    const metadata = await image.metadata();

    expect(metadata.width).to.equal(500);
    expect(metadata.height).to.equal(500);
  });

  it("should return 200 and preserve aspect ratio when using fit=inside", async () => {
    url = `/image/${publicImageId}.png?w=500&h=500&fit=inside`;
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

  it("should return 200 with the image in its original size if a larger size is requested", async () => {
    url = `/image/${publicImageId}.png?w=10000`;
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
  });

  it("should return 200 for authenticated requests to private images", async () => {
    const privateImageId = uuidv4();
    await createNewImageInCache(testUser, privateImageId, ogKey, false);

    const res = await server.inject({
      method: "GET",
      url: `/image/${privateImageId}.png`,
      headers: {
        Authorization: `Bearer ${issueSession(testUser, "testSession")}`,
      },
    });

    expect(res.statusCode).to.equal(200);
  });

  it("should return 400 if the requested width is not a number", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/image/${publicImageId}.png?w=invalid-width`,
    });

    expect(res.statusCode).to.equal(400);
  });

  it("should return 400 if the requested width is less than 1", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/image/${publicImageId}.png?w=0`,
    });

    expect(res.statusCode).to.equal(400);
  });

  it("should return 400 if the requested height is not a number", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/image/${publicImageId}.png?h=invalid-height`,
    });

    expect(res.statusCode).to.equal(400);
  });

  it("should return 400 if the requested height is less than 1", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/image/${publicImageId}.png?h=0`,
    });

    expect(res.statusCode).to.equal(400);
  });

  it("should return 400 if the requested quality is not a number", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/image/${publicImageId}.png?q=invalid-quality`,
    });

    expect(res.statusCode).to.equal(400);
  });

  it("should return 400 if the requested quality is less than 1", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/image/${publicImageId}.png?q=0`,
    });

    expect(res.statusCode).to.equal(400);
  });

  it("should return 400 if the requested quality is greater than 100", async () => {
    const res = await server.inject({
      method: "GET",
      url: `/image/${publicImageId}.png?q=101`,
    });

    expect(res.statusCode).to.equal(400);
  });

  it("should return 404 if the image does not exist", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/image/invalid-id",
    });

    expect(res.statusCode).to.equal(404);
  });

  it("should return 404 for unauthenticated requests to private images", async () => {
    const privateImageId = uuidv4();
    await createNewImageInCache(testUser, privateImageId, ogKey, false);

    const res = await server.inject({
      method: "GET",
      url: `/image/${privateImageId}.png`,
    });

    expect(res.statusCode).to.equal(404);
  });
});

describe("GET /image?url=", () => {
  it("should return 200 with the image in its original size", async () => {});

  it("should return 200 with the image in its original size if a larger size is requested", async () => {});

  it("should return 200 with the image resized if a smaller size is requested", async () => {});

  it("should return 200 with the image in a different format if requested", async () => {});

  it("should return 400 if the requested link is not a valid URL", async () => {});

  it("should return 400 if the requested link is not an image", async () => {});

  it("should return 400 if the requested width is not a number", async () => {});

  it("should return 400 if the requested width is less than 1", async () => {});

  it("should return 400 if the requested height is not a number", async () => {});

  it("should return 400 if the requested height is less than 1", async () => {});

  it("should return 400 if the requested quality is not a number", async () => {});

  it("should return 400 if the requested quality is less than 1", async () => {});

  it("should return 404 if the image does not exist", async () => {});
});
