import { expect } from "chai";
import { FastifyInstance } from "fastify";
import fs from "node:fs";
import sharp, { Sharp } from "sharp";
import { v4 as uuidv4 } from "uuid";
import config from "../../../src/config";
import {
  createNewImageInCache,
  getKeyForImage,
  listImageKeysById,
  uploadImageToBucket,
} from "../../../src/crud";
import {
  clearBucket,
  clearTable,
  getServer,
  issueSession,
  sign,
  sleep,
} from "../../util";
const imageBuff = fs.readFileSync("test/fixtures/plant.png");

const testUser = "test-user";

describe("DELETE /image/:id", () => {
  let server: FastifyInstance;
  let ogImage: Sharp;
  let ogMeta: sharp.Metadata;
  let ogKey: string;
  const publicImageId = uuidv4();

  before(async () => {
    server = await getServer();
  });

  beforeEach(async () => {
    await clearTable();
    await clearBucket();
    ogImage = sharp(imageBuff);
    ogMeta = await ogImage.metadata();

    const params = await uploadImageToBucket(testUser, publicImageId, ogImage, {
      quality: 100,
    });
    ogKey = getKeyForImage(testUser, publicImageId, params);
    await createNewImageInCache(testUser, publicImageId, ogKey, true);
  });

  it("deletes all versions of the image from the bucket", async () => {
    // Retrieve a few extra versions of the image
    const [resp1, resp2] = await Promise.all([
      server.inject({
        method: "GET",
        url: `/image/${publicImageId}.webp?w=100&h=100`,
      }),
      server.inject({
        method: "GET",
        url: `/image/${publicImageId}.webp?q=50`,
      }),
    ]);

    expect(resp1.statusCode).to.equal(200);
    expect(resp2.statusCode).to.equal(200);

    // Wait for the extra versions to be uploaded to the bucket
    await sleep(400);

    // Verify that the bucket contains the original image and the two extra versions
    let imageKeys = await listImageKeysById(testUser, publicImageId);

    expect(imageKeys).to.have.lengthOf(3);

    // Delete the image
    const resp = await server.inject({
      method: "DELETE",
      url: `/image/${publicImageId}`,
      headers: {
        Authorization: `Bearer ${issueSession(testUser, "test-user")}`,
      },
    });

    expect(resp.statusCode).to.equal(200);

    // Verify that the bucket is empty
    const imageKeysAfterDelete = await listImageKeysById(
      testUser,
      publicImageId
    );
    expect(imageKeysAfterDelete).to.have.lengthOf(0);
  });

  it("returns 200 and allow a user to delete their own image", async () => {
    const resp = await server.inject({
      method: "DELETE",
      url: `/image/${publicImageId}`,
      headers: {
        Authorization: `Bearer ${issueSession(testUser, "test-user")}`,
      },
    });

    expect(resp.statusCode).to.equal(200);
  });

  it("returns 200 and allow the system to delete an image that belongs to a user", async () => {
    const url = `/image/${publicImageId}`;
    const resp = await server.inject({
      method: "DELETE",
      url,
      headers: {
        [config.webhooks.signatureHeader]: sign(
          JSON.stringify({ url, id: publicImageId })
        ),
      },
    });

    expect(resp.statusCode).to.equal(200);
  });

  it("returns 404 and not allow a user to delete another user's image", async () => {
    const resp = await server.inject({
      method: "DELETE",
      url: `/image/${publicImageId}`,
      headers: {
        Authorization: `Bearer ${issueSession("another-user", "another-user")}`,
      },
    });

    expect(resp.statusCode).to.equal(404);
  });

  it("returns 404 and not allow a user to delete an image that does not exist", async () => {
    const resp = await server.inject({
      method: "DELETE",
      url: `/image/${uuidv4()}`,
      headers: {
        Authorization: `Bearer ${issueSession(testUser, "test-user")}`,
      },
    });

    expect(resp.statusCode).to.equal(404);
  });

  it("returns 404 and not allow the system to delete an image that does not exist", async () => {
    const fakeId = uuidv4();
    const url = `/image/${fakeId}`;
    const resp = await server.inject({
      method: "DELETE",
      url,
      headers: {
        [config.webhooks.signatureHeader]: sign(
          JSON.stringify({ url, id: fakeId })
        ),
      },
    });

    expect(resp.statusCode).to.equal(404);
  });
});
