import { FastifyInstance } from "fastify";
import {
  ErrorResponse,
  ImageQueryParams,
  ImageUrl,
  errorResponseSchema,
  imageQueryParamsSchema,
  imageUrlSchema,
} from "../types";
import {
  getImageFromDb,
  getImageFromBucket,
  uploadImageToBucket,
  addNewImageVersionToDb,
} from "../crud";
import { Sharp } from "sharp";

const routes = (fastify: FastifyInstance, _: any, done: Function) => {
  /**
   * GET /image/:id.:ext?w=:w&h=:h&q=:q
   *
   * Get image by id. If the image does not exist in the requested extension, size,
   * or quality, the new version will be created, stored in the bucket, and returned.
   */
  fastify.get<{
    Params: ImageUrl;
    Querystring: ImageQueryParams;
    Response: Buffer | ErrorResponse;
  }>(
    "/image/:id.:ext",
    {
      schema: {
        params: imageUrlSchema,
        querystring: imageQueryParamsSchema,
        response: {
          200: {
            description: "Ok",
            media: {
              type: "image/*",
            },
          },
          404: errorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const { id, ext } = req.params;
      const { w, h, q } = req.query;

      const imgData = await getImageFromDb(id, fastify.log);
      if (!imgData) {
        return reply.code(404).send({
          error: "Image not found",
        });
      }

      const version = imgData.versions.find(
        (v) => v.w === w && v.h === h && v.q === q && v.ext === ext
      );

      if (!version) {
        const best = imgData.versions.reduce((prev, current) =>
          prev.w > current.w && prev.q > current.q ? prev : current
        );
        const img = (await getImageFromBucket(best.key, "sharp")) as Sharp;

        const asRequested = img
          .resize({
            width: w,
            height: h,
            fit: "fill",
          })
          .toFormat(ext, { quality: q });

        const newVersion = await uploadImageToBucket(id, asRequested, q);
        await addNewImageVersionToDb(id, newVersion, fastify.log);

        reply.type(`image/${ext}`).send(await asRequested.toBuffer());
        return;
      }

      const img = await getImageFromBucket(version.key, "stream");
      reply.type(`image/${ext}`).send(img);
    }
  );

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
   * GET /image?url=:url&w=:w&h=:h&q=:q&ext=:ext
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
