import { FastifyInstance } from "fastify";
import sharp, { Sharp } from "sharp";
import {
  getBestImageByID,
  getImageFromBucketByKey,
  getImageFromCacheById,
  getKeyForImage,
  uploadImageToBucket,
} from "../crud";
import { optionalUserSession } from "../middleware/audiences";
import {
  ErrorResponse,
  ImageQueryParams,
  ImageUrl,
  errorResponseSchema,
  getFormatFromExtension,
  getFullPositionName,
  imageQueryParamsSchema,
  imageUrlSchema,
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
        const bestMeta = await best.metadata();
        const bestExt = bestMeta.format;

        let toReturn = best;
        let changed = false;

        // Only resize if necessary
        if (
          (requestedImageParams.width &&
            requestedImageParams.width < bestMeta.width!) ||
          (requestedImageParams.height &&
            requestedImageParams.height < bestMeta.height!)
        ) {
          const resizeOptions: sharp.ResizeOptions = {
            width: w,
            height: h,
            fit: fit || ("cover" as any),
            kernel: kernel || ("lanczos3" as any),
          };
          if (
            pos &&
            resizeOptions.fit &&
            ["cover", "container"].includes(resizeOptions.fit)
          ) {
            resizeOptions.position = getFullPositionName(pos);
          }

          if (bg && resizeOptions.fit === "contain") {
            resizeOptions.background = getRgba(bg);
          }

          toReturn = best.resize(resizeOptions);
          changed = true;
        }

        if (
          (requestedImageParams.quality &&
            requestedImageParams.quality < bestParams.quality!) ||
          ext !== bestExt
        ) {
          const fmtParams = { ...req.query };
          utilsByFormat[requestedImageParams.format].clean(fmtParams);
          toReturn = toReturn.toFormat(ext, fmtParams);
          changed = true;
        }

        // Go ahead and send the image back to the user
        reply
          .type(`image/${requestedImageParams.format}`)
          .send(await toReturn.toBuffer());

        // And then only upload it if it's not already in the bucket
        if (changed) {
          await uploadImageToBucket(
            cacheRecord.user,
            id,
            toReturn,
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
  // fastify.post<{
  //   Body: ImageUpload;
  //   Response: Image | ErrorResponse;
  // }>(
  //   "/image",
  //   {
  //     schema: {
  //       body: imageUploadSchema,
  //       response: {
  //         200: {
  //           description: "Ok",
  //         },
  //       },
  //     },
  //     preValidation: [either(dreamupUserSession, dreamupInternal)],
  //   },
  //   async (req, reply) => {
  //     const { url, image, force } = req.body;

  //     let img: Sharp | undefined;
  //     let id: string | undefined;
  //     if (url) {
  //       const cachedImage = await getImageFromDbByUrl(url, fastify.log);
  //       if (cachedImage && !force) {
  //         return reply.code(200).send(cachedImage);
  //       }

  //       id = cachedImage?.id || uuidv4();

  //       // download image with fetch
  //       try {
  //         const res = await fetch(url);
  //         if (!res.ok) {
  //           return reply.code(400).send({
  //             error: "Invalid url",
  //           });
  //         }
  //         const data = await res.arrayBuffer();
  //         img = sharp(data);
  //       } catch (e) {
  //         fastify.log.error(e);
  //         return reply.code(500).send({
  //           error: "Error downloading image",
  //         });
  //       }
  //     } else if (image) {
  //       // decode base64 image
  //       const imgBuff = Buffer.from(image, "base64");

  //       // Get sha of image
  //       const sha = crypto.createHash("sha256", {
  //         outputLength: 16,
  //       });
  //       sha.update(imgBuff);
  //       id = sha.digest("base64");

  //       const cachedImage = await getImageFromDbById(id, fastify.log);
  //       if (cachedImage && !force) {
  //         return reply.code(200).send(cachedImage);
  //       }

  //       try {
  //         img = sharp(imgBuff);
  //       } catch (e) {
  //         fastify.log.error(e);
  //         return reply.code(400).send({
  //           error: "Invalid base64 image",
  //         });
  //       }
  //     }

  //     if (!img) {
  //       return reply.code(400).send({
  //         error: "No image provided",
  //       });
  //     }

  //     if (!id) {
  //       id = uuidv4();
  //     }

  //     const newImageVersion = await uploadImageToBucket(id, img, 100);

  //     // Create a new image if we aren't working from a cache. If we are working from a cache,
  //     // we only need to add the new version to the db, and then only if it doesn't already exist.
  //     const newImageForDb: Image = {
  //       id,
  //       versions: [newImageVersion],
  //       user: req.user?.userId || "internal",
  //       url,
  //     };
  //     try {
  //       const newImage = await createNewImageInDb(newImageForDb, fastify.log);
  //       return reply.code(201).send(newImage);
  //     } catch (e: any) {
  //       if (e.name === "ImageAlreadyExists") {
  //         return reply.code(409).send({
  //           error: "Image already exists",
  //         });
  //       }
  //       fastify.log.error(e);
  //       return reply.code(500).send({
  //         error: "Error creating image",
  //       });
  //     }
  //   }
  // );

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
