import { FastifyInstance } from "fastify";
import path from "path";
import sharp, { Sharp } from "sharp";
import { v4 as uuidv4 } from "uuid";
import {
  checkCacheForUrl,
  createNewImageInCache,
  deleteImageFromBucketByKey,
  getBestImageByID,
  getImageFromBucketByKey,
  getImageFromCacheById,
  getKeyForImage,
  listImageKeysById,
  removeImageFromCacheById,
  uploadImageToBucket,
} from "../crud";
import {
  dreamupInternal,
  dreamupUserSession,
  either,
  optionalUserSession,
} from "../middleware/audiences";
import {
  DeletedResponse,
  ErrorResponse,
  IdParam,
  ImageParams,
  ImageQueryParams,
  ImageUpload,
  ImageUploadResponse,
  ImageUrl,
  SupportedInputImageExtension,
  SupportedOutputImageExtension,
  UrlCacheQueryParams,
  deletedResponseSchema,
  errorResponseSchema,
  getFormatFromExtension,
  getFullPositionName,
  idParamSchema,
  imageQueryParamsSchema,
  imageUploadResponseSchema,
  imageUploadSchema,
  imageUrlSchema,
  supportedInputImageExtensions,
  supportedOutputImageExtensions,
  urlCacheQueryParamsSchema,
  utilsByFormat,
} from "../types";

const rgbaRegex = /^rgba\((\d{1,3}),(\d{1,3}),(\d{1,3}),(\d\.?\d?)\)$/i;
const rgbRegex = /^rgb\((\d{1,3}),(\d{1,3}),(\d{1,3})\)$/i;

const getRgba = (color: string = "") => {
  let match = rgbRegex.exec(color);
  if (match) {
    const [, r, g, b] = match;
    return {
      r: Number(r),
      g: Number(g),
      b: Number(b),
      alpha: 1,
    };
  }
  match = rgbaRegex.exec(color);
  if (match) {
    const [, r, g, b, a] = match;
    return {
      r: Number(r),
      g: Number(g),
      b: Number(b),
      alpha: Number(a),
    };
  }
  return {
    r: 0,
    g: 0,
    b: 0,
    alpha: 0,
  };
};

const coerceToRequested = async (
  img: Sharp,
  requestedParams: ImageParams,
  ext: SupportedOutputImageExtension,
  formatParams: any
) => {
  let changed = false;
  let actualMeta = await img.metadata();
  const format = getFormatFromExtension(ext);
  // Only resize if necessary
  if (
    (requestedParams.width && requestedParams.width < actualMeta.width!) ||
    (requestedParams.height && requestedParams.height < actualMeta.height!)
  ) {
    const resizeOptions: sharp.ResizeOptions = {
      width: requestedParams.width,
      height: requestedParams.height,
      fit: requestedParams.fit || ("cover" as any),
      kernel: requestedParams.kernel || ("lanczos3" as any),
    };
    if (
      requestedParams.pos &&
      resizeOptions.fit &&
      ["cover", "container"].includes(resizeOptions.fit)
    ) {
      resizeOptions.position = getFullPositionName(requestedParams.pos);
    }

    if (requestedParams.bg && resizeOptions.fit === "contain") {
      resizeOptions.background = getRgba(requestedParams.bg);
    }

    img = img.resize(resizeOptions);
    changed = true;
  }

  if (
    (requestedParams.quality && requestedParams.quality < 100) ||
    format !== actualMeta.format
  ) {
    utilsByFormat[format].clean(formatParams);
    img = img.toFormat(format, formatParams);
    changed = true;
  }
  return { changed, img };
};

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
            content: {
              "image/*": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
            },
          },
          404: errorResponseSchema,
        },
      },
      preValidation: [
        async (req, reply) => {
          const { ext } = req.params;
          const { validate } = utilsByFormat[getFormatFromExtension(ext)];
          if (!validate(req.query)) {
            return reply.code(400).send({
              error: "Query Validation Error",
              errors: validate.errors?.map((e) => e.message) || [],
            });
          }
        },

        // Images can be public, so we don't require a user session.
        // However, if a user session is provided, we will use it to
        // check if the user has access to the image.
        optionalUserSession,
      ],
    },
    async (req, reply) => {
      const { id, ext } = req.params;
      const { w, width, h, height, fit, pos, bg, kernel, q, quality } =
        req.query;

      const user = req.user?.userId;

      const cacheRecord = await getImageFromCacheById(id);

      if (!cacheRecord || (cacheRecord.user !== user && !cacheRecord.public)) {
        return reply.code(404).send({
          error: "Image Not Found",
          message: "The requested image does not exist.",
        });
      }

      const requestedImageParams = {
        width: w || width,
        height: h || height,
        quality: q || quality,
        fit,
        pos: pos ? getFullPositionName(pos) : (undefined as any),
        bg,
        kernel,
        format: getFormatFromExtension(ext),
      };

      req.query.quality = requestedImageParams.quality;

      const key = getKeyForImage(cacheRecord.user, id, requestedImageParams);

      // console.log("REQUESTED KEY", key);

      try {
        const img = (await getImageFromBucketByKey(key, "sharp")) as Sharp;
        // console.log("Image exists in bucket, sending back to user");
        return reply.type(`image/${ext}`).send(await img.toBuffer());
      } catch (e: any) {
        if (e.name !== "ImageDoesNotExist") {
          throw e;
        }
      }

      try {
        const { img: best, params: bestParams } = await getBestImageByID(
          cacheRecord.user,
          id
        );

        const { img, changed } = await coerceToRequested(
          best,
          requestedImageParams,
          ext,
          { ...req.query }
        );
        reply
          .type(`image/${requestedImageParams.format}`)
          .send(await img.toBuffer());

        // And then only upload it if it's not already in the bucket
        if (changed) {
          await uploadImageToBucket(
            cacheRecord.user,
            id,
            img,
            requestedImageParams
          );
        }
      } catch (e: any) {
        if (e.name === "ImageDoesNotExist") {
          return reply.code(404).send({
            error: "Image not found",
          });
        } else {
          throw e;
        }
      }
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
    Response: ImageUploadResponse | ErrorResponse;
  }>(
    "/image",
    {
      schema: {
        body: imageUploadSchema,
        response: {
          200: {
            description: "Ok",
            content: {
              "application/json": {
                schema: imageUploadResponseSchema,
              },
            },
          },
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
      preValidation: [either(dreamupUserSession, dreamupInternal)],
    },
    async (req, reply) => {
      const { url, image, force } = req.body;
      const user = req.user?.userId || "internal";
      if (url) {
        // Check the cache first
        let cacheEntry = await checkCacheForUrl(url);
        if (cacheEntry && !force) {
          return reply.code(304).send({ id: cacheEntry.id });
        }

        const res = await fetch(url);
        if (!res.ok) {
          return reply.code(res.status).send({ error: await res.text() });
        }

        // Use sharp to validate the image
        const data = await res.arrayBuffer();
        const img = sharp(data);

        let actualMeta: sharp.Metadata;
        try {
          actualMeta = await img.metadata();
        } catch (e: any) {
          return reply.code(400).send({
            error: "Invalid image",
          });
        }
        if (!actualMeta.format) {
          return reply.code(400).send({
            error: "Invalid image",
          });
        }

        const id = cacheEntry?.id || uuidv4();

        const params = await uploadImageToBucket(user, id, img, {});
        const key = getKeyForImage(user, id, params);
        cacheEntry = await createNewImageInCache(user, id, key, true, url);

        return reply.code(201).send({ id });
      }

      if (image) {
        const img = sharp(Buffer.from(image, "base64"));
        const actualMeta = await img.metadata();
        if (!actualMeta.format) {
          return reply.code(400).send({
            error: "Invalid image",
          });
        }

        const id = uuidv4();

        const params = await uploadImageToBucket(user, id, img, {});
        const key = getKeyForImage(user, id, params);
        await createNewImageInCache(user, id, key, true);

        return reply.code(201).send({ id });
      }

      return reply.code(400).send({
        error: "Invalid request",
      });
    }
  );

  /**
   * DELETE /image/:id
   *
   * Delete all versions of an image from the bucket.
   */
  fastify.delete<{
    Params: IdParam;
    Response: ErrorResponse | DeletedResponse;
  }>(
    "image/:id",
    {
      schema: {
        params: idParamSchema,
        response: {
          200: {
            description: "Ok",
            content: {
              "application/json": {
                schema: deletedResponseSchema,
              },
            },
          },
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
      preValidation: [either(dreamupUserSession, dreamupInternal)],
    },
    async (req, reply) => {
      const { id } = req.params;
      const user = req.user?.userId || "internal";

      const toDelete = await listImageKeysById(user, id);
      if (toDelete.length === 0) {
        return reply.code(404).send({
          error: "Image not found",
        });
      }

      // This way we stop serving the image from the cache immediately, but don't wait for the bucket to delete it.
      await removeImageFromCacheById(id);

      try {
        await Promise.all(
          toDelete.map((key) => deleteImageFromBucketByKey(key))
        );
      } catch (e: any) {
        if (e.name === "NoSuchKey") {
          // My guess is that this would happen if the image had already been deleted from the bucket by a different request.
          fastify.log.warn(`Tried to delete non-existent key ${e.key}`);
        } else {
          throw e;
        }
      }
    }
  );

  /**
   * GET /image?url=:url&w=:w&h=:h&q=:q&ext=:ext
   *
   * A read-through cache for web images. If the image does not exist in the requested extension, size,
   * or quality, the new version will be created, stored in the bucket, and returned.
   */
  fastify.get<{
    Querystring: UrlCacheQueryParams;
    Response: Buffer | ErrorResponse;
  }>(
    "/image",
    {
      schema: {
        querystring: urlCacheQueryParamsSchema,
        response: {
          200: {
            description: "Ok",
            content: {
              "image/*": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
            },
          },
          404: errorResponseSchema,
          400: errorResponseSchema,
        },
      },
      preValidation: [either(dreamupUserSession, dreamupInternal)],
    },
    async (req, reply) => {
      const {
        url,
        w,
        width,
        h,
        height,
        fit,
        pos,
        bg,
        kernel,
        q,
        quality,
        fmt,
      } = req.query;
      const user = req.user?.userId || "internal";

      // Get the extension from the url
      const parsedUrl = new URL(url);
      let ext = path
        .extname(parsedUrl.pathname)
        .substring(1) as SupportedInputImageExtension;
      if (!supportedInputImageExtensions.includes(ext as any)) {
        return reply.code(400).send({
          error: "Invalid image extension",
        });
      }

      if (!supportedOutputImageExtensions.includes(ext as any)) {
        ext = "webp";
      }

      const requestedImageParams = {
        width: w || width,
        height: h || height,
        quality: q || quality,
        fit,
        pos: pos ? getFullPositionName(pos) : (undefined as any),
        bg,
        kernel,
        format:
          fmt || getFormatFromExtension(ext as SupportedOutputImageExtension),
      };

      req.query.quality = requestedImageParams.quality;

      let cacheRecord = await checkCacheForUrl(url);
      let img: sharp.Sharp | undefined;
      let actualMeta: sharp.Metadata | undefined;

      if (!cacheRecord) {
        // Fetch the image from the url
        const res = await fetch(url);
        if (!res.ok) {
          return reply.code(res.status).send({ error: await res.text() });
        }

        // Use sharp to validate the image
        const data = await res.arrayBuffer();
        img = sharp(data);
        actualMeta = await img.metadata();
        if (!actualMeta.format) {
          return reply.code(400).send({
            error: "Invalid image",
          });
        }

        const id = uuidv4();

        // const key = getKeyForImage(cacheRecord.user, id, requestedImageParams);

        const params = await uploadImageToBucket(user, id, img, {});
        const key = getKeyForImage(user, id, params);
        cacheRecord = await createNewImageInCache(user, id, key, true, url);
      }

      if (!img) {
        const key = getKeyForImage(
          cacheRecord.user,
          cacheRecord.id,
          requestedImageParams
        );
        try {
          img = (await getImageFromBucketByKey(key, "sharp")) as Sharp;
        } catch (e: any) {
          if (e.name !== "ImageDoesNotExist") {
            throw e;
          }

          img = (await getBestImageByID(cacheRecord.id, "sharp")).img;
        }
        actualMeta = await img.metadata();
      }

      // Resize and reformat if necessary
      const { changed, img: newImg } = await coerceToRequested(
        img,
        requestedImageParams,
        requestedImageParams.format,
        { ...req.query }
      );
      reply
        .type(`image/${requestedImageParams.format}`)
        .send(await newImg.toBuffer());

      // And then only upload it if it's not already in the bucket
      if (changed) {
        await uploadImageToBucket(
          cacheRecord.user,
          cacheRecord.id,
          newImg,
          requestedImageParams
        );
      }
    }
  );

  /**
   * GET /images
   *
   * List all images owned by the current user
   */

  done();
};

export default routes;
