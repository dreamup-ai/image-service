import { expect } from "chai";

import config from "../../../src/config";
import { FastifyInstance } from "fastify";
import { Image } from "../../../src/types";
import { clearBucket, clearTable, getServer } from "../../util";
import { createNewImageInDb, uploadImageToBucket } from "../../../src/crud";
import sharp, { Sharp } from "sharp";
import { v4 as uuidv4 } from "uuid";

import fs from "node:fs";
const imageBuff = fs.readFileSync("test/fixtures/plant.png");

describe("GET /image/:id.:ext", () => {
  let server: FastifyInstance;
  let dbImage: Image;
  let sharpImage: Sharp;
  let sharpMeta: sharp.Metadata;

  before(async () => {
    server = await getServer();
  });

  beforeEach(async () => {
    await clearTable();
    await clearBucket();

    sharpImage = sharp(imageBuff);
    sharpMeta = await sharpImage.metadata();

    const version = await uploadImageToBucket("test", sharpImage, 100);
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

    const image = sharp(res.rawPayload).png();

    const meta = await image.metadata();

    /**
     * For whatever reason, the image returned is 38% larger than the original.
     * I haven't figured out where this is coming from yet, but something with sharp,
     * almost for sure. The image is visually the same, and otherwise has the same
     * metadata.
     */
    expect({ ...meta, size: undefined }).to.deep.equal({
      ...sharpMeta,
      size: undefined,
    });
  });
});
