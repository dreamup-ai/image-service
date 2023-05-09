import crypto from "crypto";
import { FastifyInstance } from "fastify";
import sharp, { Sharp } from "sharp";
import { v4 as uuidv4 } from "uuid";
import {
  addNewImageVersionToDb,
  createNewImageInDb,
  getImageFromBucket,
  getImageFromDbById,
  getImageFromDbByUrl,
  uploadImageToBucket,
} from "../crud";
import {
  dreamupInternal,
  dreamupUserSession,
  either,
} from "../middleware/audiences";
import {
  ErrorResponse,
  Image,
  ImageQueryParams,
  ImageUpload,
  ImageUrl,
  ImageVersion,
  errorResponseSchema,
  imageQueryParamsSchema,
  imageSchema,
  imageUploadSchema,
  imageUrlSchema,
} from "../types";

const rgbaRegex = /^rgba\((\d{1,3}),(\d{1,3}),(\d{1,3}),(\d\.?\d?)\)$/i;
const rgbRegex = /^rgb\((\d{1,3}),(\d{1,3}),(\d{1,3})\)$/i;

const positionMap = {
  righttop: "right top",
  rightbottom: "right bottom",
  leftbottom: "left bottom",
  lefttop: "left top",
  rt: "right top",
  r: "right",
  rb: "right bottom",
  b: "bottom",
  lb: "left bottom",
  l: "left",
  lt: "left top",
  n: "north",
  ne: "northeast",
  e: "east",
  se: "southeast",
  s: "south",
  sw: "southwest",
  w: "west",
  nw: "northwest",
  c: "center",
};

const normalizePosition = (position: string) => {
  if (positionMap.hasOwnProperty(position)) {
    return positionMap[position as keyof typeof positionMap];
  }
  return position;
};

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
    },
    async (req, reply) => {
      const { id, ext } = req.params;
      const { w, h, q, fit, pos, bg, kernel } = req.query;

      const imgData = await getImageFromDbById(id, fastify.log);
      if (!imgData) {
        return reply.code(404).send({
          error: "Image not found",
        });
      }

      let version: ImageVersion | undefined;
      let img: Sharp | undefined;

      const matchesRequest = (v: ImageVersion) =>
        (v.w === w || w === undefined) &&
        (v.h === h || h === undefined) &&
        (v.q === q || q === undefined) &&
        v.ext === ext;

      if (w || h || q) {
        version = imgData.versions.find(matchesRequest);
      }

      if (version) {
        img = (await getImageFromBucket(version.key, "sharp")) as Sharp;
        return reply.type(`image/${ext}`).send(await img.toBuffer());
      } else {
        version = imgData.versions.reduce((prev, current) =>
          prev.w > current.w && prev.q > current.q ? prev : current
        );

        img = (await getImageFromBucket(version.key, "sharp")) as Sharp;

        if (matchesRequest(version)) {
          console.log("returning best image");
          return reply.type(`image/${ext}`).send(await img.toBuffer());
        }
      }

      if (!img) {
        return reply.code(404).send({
          error: "Image not found",
        });
      }

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
        resizeOptions.position = normalizePosition(pos);
      }

      if (bg && resizeOptions.fit === "contain") {
        resizeOptions.background = getRgba(bg);
      }

      let asRequested = img.resize(resizeOptions);

      if (ext !== version.ext || q !== version.q) {
        asRequested = asRequested.toFormat(ext, { quality: q });
      }

      reply.type(`image/${ext}`).send(await asRequested.toBuffer());
      version = await uploadImageToBucket(
        id,
        asRequested,
        q,
        resizeOptions.fit,
        pos ? normalizePosition(pos) : (undefined as any)
      );
      await addNewImageVersionToDb(id, version, fastify.log);
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
        response: {
          200: imageSchema,
        },
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

      // Create a new image if we aren't working from a cache. If we are working from a cache,
      // we only need to add the new version to the db, and then only if it doesn't already exist.
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
