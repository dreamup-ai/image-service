import { expect } from "chai";
import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import config from "../../../src/config";
import { createNewImageInCache } from "../../../src/crud";
import { clearTable, getServer, issueSession } from "../../util";

describe("GET /images", () => {
  let server: FastifyInstance;
  let imageIds: string[];

  before(async () => {
    server = await getServer();
    await clearTable();
    imageIds = (
      await Promise.all(
        Array(5)
          .fill(0)
          .map(async (_, i) => {
            const id = uuidv4();
            await createNewImageInCache(
              "test-user",
              id,
              `test-key-${i}`,
              false
            );
            return id;
          })
      )
    ).sort();
  });

  after(async () => {
    await clearTable();
  });

  it("returns 200 a list of image ids", async () => {
    // Populate the cache with a few images
    const resp = await server.inject({
      method: "GET",
      url: "/images",
      cookies: {
        [config.session.cookieName]: issueSession("test-user", "test-user"),
      },
    });

    expect(resp.statusCode).to.equal(200);
    const body = resp.json();
    body.images.sort();
    expect(body).to.deep.equal({
      images: imageIds,
    });
  });

  it("returns 200 a list of image ids with a limit", async () => {
    const resp = await server.inject({
      method: "GET",
      url: "/images?limit=2",
      cookies: {
        [config.session.cookieName]: issueSession("test-user", "test-user"),
      },
    });

    expect(resp.statusCode).to.equal(200);
    const body = resp.json();
    expect(body.images).to.have.lengthOf(2);
    expect(body).to.have.property("next");
  });

  it("returns 200 a list of image ids with a limit and pagination token", async () => {
    let resp = await server.inject({
      method: "GET",
      url: "/images?limit=2",
      cookies: {
        [config.session.cookieName]: issueSession("test-user", "test-user"),
      },
    });

    const body1 = resp.json();

    resp = await server.inject({
      method: "GET",
      url: `/images?limit=4&token=${body1.next}`,
      cookies: {
        [config.session.cookieName]: issueSession("test-user", "test-user"),
      },
    });

    const body2 = resp.json();

    expect(resp.statusCode).to.equal(200);
    expect(body2.images).to.have.lengthOf(3);
    expect(body2).to.not.have.property("next");

    const allImages = [...body1.images, ...body2.images].sort();
    expect(allImages).to.deep.equal(imageIds);
  });
});
