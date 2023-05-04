import { FastifyInstance } from "fastify";

const routes = (fastify: FastifyInstance, _: any, done: Function) => {
  /**
   * GET /image/:id.:ext?w=:w&h=:h&q=:q
   *
   * Get image by id. If the image does not exist in the requested extension, size,
   * or quality, the new version will be created, stored in the bucket, and returned.
   */

  /**
   * POST /image
   *
   * Upload a new image to the bucket, downloading it first if a url is provided.
   * Also accepts a base64 encoded image.
   */

  /**
   * DELETE /image/:id
   *
   * Delete all versions of an image from the bucket.
   */

  /**
   * GET /image?url=:url&w=:w&h=:h&q=:q
   *
   * A read-through cache for web images. If the image does not exist in the requested extension, size,
   * or quality, the new version will be created, stored in the bucket, and returned.
   */

  /**
   * GET /image
   *
   * List all images owned by the current user
   */

  done();
};

export default routes;
