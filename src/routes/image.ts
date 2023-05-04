import { FastifyInstance } from "fastify";
import {
  ErrorResponse,
  Image,
  ImageQueryParams,
  ImageUpload,
  ImageUrl,
  errorResponseSchema,
  imageQueryParamsSchema,
  imageSchema,
  imageUploadSchema,
  imageUrlSchema,
} from "../types";
import {
  getImageFromDbById,
  getImageFromBucket,
  uploadImageToBucket,
  addNewImageVersionToDb,
  createNewImageInDb,
  getImageFromDbByUrl,
} from "../crud";
import sharp, { Sharp } from "sharp";
import {
  dreamupInternal,
  either,
  dreamupUserSession,
} from "../middleware/audiences";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

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

      const imgData = await getImageFromDbById(id, fastify.log);
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

        return reply.type(`image/${ext}`).send(await asRequested.toBuffer());
      }

      const img = await getImageFromBucket(version.key, "stream");
      return reply.type(`image/${ext}`).send(img);
    }
  );

  /**
   * POST /image
   *
   * Upload a new image to the bucket, downloading it first if a url is provided.
   * Also accepts a base64 encoded image.
   */
  fastify.post<{
    Body: ImageUpload;
    Response: Image | ErrorResponse;
  }>(
    "/image",
    {
      schema: {
        body: imageUploadSchema,
        response: imageSchema,
      },
      preValidation: [either(dreamupUserSession, dreamupInternal)],
    },
    async (req, reply) => {
      const { url, image, force } = req.body;

      let img: Sharp | undefined;
      let id: string | undefined;
      if (url) {
        const cachedImage = await getImageFromDbByUrl(url, fastify.log);
        if (cachedImage && !force) {
          return reply.code(200).send(cachedImage);
        }

        id = cachedImage?.id || uuidv4();

        // download image with fetch
        try {
          const res = await fetch(url);
          if (!res.ok) {
            return reply.code(400).send({
              error: "Invalid url",
            });
          }
          const data = await res.arrayBuffer();
          img = sharp(data);
        } catch (e) {
          fastify.log.error(e);
          return reply.code(500).send({
            error: "Error downloading image",
          });
        }
      } else if (image) {
        // decode base64 image
        const imgBuff = Buffer.from(image, "base64");

        // Get sha of image
        const sha = crypto.createHash("sha256", {
          outputLength: 16,
        });
        sha.update(imgBuff);
        id = sha.digest("base64");

        const cachedImage = await getImageFromDbById(id, fastify.log);
        if (cachedImage && !force) {
          return reply.code(200).send(cachedImage);
        }

        try {
          img = sharp(imgBuff);
        } catch (e) {
          fastify.log.error(e);
          return reply.code(400).send({
            error: "Invalid base64 image",
          });
        }
      }

      if (!img) {
        return reply.code(400).send({
          error: "No image provided",
        });
      }

      if (!id) {
        id = uuidv4();
      }

      const newImageVersion = await uploadImageToBucket(id, img, 100);
      const newImageForDb: Image = {
        id,
        versions: [newImageVersion],
        user: req.user?.userId || "internal",
        url,
      };
      try {
        const newImage = await createNewImageInDb(newImageForDb, fastify.log);
        return reply.code(201).send(newImage);
      } catch (e: any) {
        if (e.name === "ImageAlreadyExists") {
          return reply.code(409).send({
            error: "Image already exists",
          });
        }
        fastify.log.error(e);
        return reply.code(500).send({
          error: "Error creating image",
        });
      }
    }
  );

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
