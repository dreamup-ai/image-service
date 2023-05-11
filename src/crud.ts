import { GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { Item } from "dynamo-tools";
import sharp, { Sharp } from "sharp";
import internal from "stream";
import { client as dynamo } from "./clients/dynamo";
import { client as s3 } from "./clients/s3";
import config from "./config";
import {
  CachedUrl,
  ImageParams,
  SupportedOutputImageExtension,
  coerceImageParams,
  supportedOutputImageExtensions,
} from "./types";

const { imageTable } = config.db;

// export const createNewImageInDb = async (
//   image: Image,
//   log: FastifyBaseLogger
// ): Promise<Image> => {
//   if (!image.id) {
//     image.id = uuidv4();
//   }
//   if (!image.versions || !image.versions.length) {
//     throw new Error("Cannot create image without versions");
//   }

//   const createCmd = new PutItemCommand({
//     TableName: imageTable,
//     Item: Item.fromObject(image),
//     ConditionExpression: "attribute_not_exists(id)",
//   });

//   try {
//     await dynamo.send(createCmd);

//     sendWebhook("image.created", image, log);
//     return image;
//   } catch (e: any) {
//     if (e.name === "ConditionalCheckFailedException") {
//       const err = new Error("Image already exists");
//       err.name = "ImageAlreadyExists";
//       throw err;
//     }
//     throw e;
//   }
// };

// export const addNewImageVersionToDb = async (
//   id: string,
//   version: ImageVersion,
//   log: FastifyBaseLogger
// ): Promise<Image> => {
//   const updateCmd = new UpdateItemCommand({
//     TableName: imageTable,
//     Key: Item.fromObject({ id }),
//     UpdateExpression: "SET #versions = list_append(#versions, :version)",
//     ExpressionAttributeNames: {
//       "#versions": "versions",
//     },
//     ExpressionAttributeValues: {
//       ":version": Item.fromObject([version]),
//     },
//     ReturnValues: "ALL_NEW",
//     ConditionExpression: "attribute_exists(id)",
//   });

//   try {
//     const { Attributes } = await dynamo.send(updateCmd);
//     const updatedImg = Item.toObject(Attributes) as Image;
//     sendWebhook("image.updated", updatedImg, log);
//     return updatedImg;
//   } catch (e: any) {
//     if (e.name === "ConditionalCheckFailedException") {
//       const err = new Error("Image does not exist");
//       err.name = "ImageDoesNotExist";
//       throw err;
//     }
//     throw e;
//   }
// };

// export const getImageFromDbById = async (
//   id: string,
//   log: FastifyBaseLogger
// ): Promise<Image | null> => {
//   const getCmd = new GetItemCommand({
//     TableName: imageTable,
//     Key: Item.fromObject({ id }),
//   });

//   const { Item: item } = await dynamo.send(getCmd);
//   if (!item) {
//     return null;
//   }
//   const image = Item.toObject(item) as Image;
//   return image;
// };

export const checkCacheForUrl = async (url: string): Promise<string | null> => {
  const getCmd = new GetItemCommand({
    TableName: imageTable,
    Key: Item.fromObject({ url }),
  });

  const { Item: item } = await dynamo.send(getCmd);
  if (!item) {
    return null;
  }

  const image = Item.toObject(item) as CachedUrl;

  const nowInSeconds = Math.floor(Date.now() / 1000);

  if (image.exp && image.exp < nowInSeconds) {
    return null;
  }

  return image.id;
};

export const addUrlToCache = async (url: string, id: string): Promise<void> => {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const createCmd = new PutItemCommand({
    TableName: imageTable,
    Item: Item.fromObject({
      id,
      url,
      exp: nowInSeconds + config.db.urlCacheTTLSeconds,
    }),
    ConditionExpression: "attribute_not_exists(id)",
  });

  try {
    await dynamo.send(createCmd);
  } catch (e: any) {
    if (e.name === "ConditionalCheckFailedException") {
      return;
    }
    throw e;
  }
};

// export const getImageFromDbByUrl = async (
//   url: string,
//   log: FastifyBaseLogger
// ): Promise<Image | null> => {
//   const getCmd = new QueryCommand({
//     TableName: imageTable,
//     IndexName: "url",
//     KeyConditionExpression: "#url = :url",
//     ExpressionAttributeNames: {
//       "#url": "url",
//     },
//     ExpressionAttributeValues: {
//       ":url": Item.fromObject(url),
//     },
//   });

//   const { Items } = await dynamo.send(getCmd);
//   if (!Items || !Items.length) {
//     return null;
//   }
//   const image = Item.toObject(Items[0]) as Image;
//   return image;
// };

// export const deleteImageFromDb = async (
//   id: string,
//   log: FastifyBaseLogger
// ): Promise<void> => {
//   const deleteCmd = new DeleteItemCommand({
//     TableName: imageTable,
//     Key: Item.fromObject({ id }),
//     ReturnValues: "ALL_OLD",
//     ConditionExpression: "attribute_exists(id)",
//   });

//   try {
//     const { Attributes } = await dynamo.send(deleteCmd);
//     const image = Item.toObject(Attributes) as Image;
//     sendWebhook("image.deleted", image, log);
//   } catch (e: any) {
//     if (e.name === "ConditionalCheckFailedException") {
//       const err = new Error("Image does not exist");
//       err.name = "ImageDoesNotExist";
//       throw err;
//     }
//     throw e;
//   }
// };

export const getFilenameForImage = (
  id: string,
  params: ImageParams
): string => {
  return (
    id +
    "_" +
    Object.keys(params)
      .filter((k) => k != "format")
      .sort()
      .map((k) => `${k}:${params[k]}`)
      .join("-") +
    "." +
    params.format
  );
};

export const getKeyForImage = (
  user: string,
  id: string,
  params: ImageParams
): string => {
  return `${config.bucket.prefix}${user}/${getFilenameForImage(id, params)}`;
};

export const getParamsFromKey = (key: string): ImageParams => {
  const keySplit = key.split(".");
  const format = keySplit.pop();
  const everythingBeforeFormat = keySplit.join(".");
  const [, paramString] = everythingBeforeFormat.split("_");
  const params = paramString.split("-").reduce(
    (acc, cur) => {
      const [key, value] = cur.split(":");
      return { ...acc, [key]: value };
    },
    { format }
  );
  if (!coerceImageParams(params)) {
    const err = new Error("Invalid image params");
    err.name = "ImageParamsError";
    throw err;
  }
  return params;
};

export const uploadImageToBucket = async (
  user: string,
  id: string,
  image: Sharp,
  params: ImageParams
): Promise<ImageParams> => {
  const buffer = await image.toBuffer();
  const meta = await image.metadata();
  const { width, height, format } = meta;
  // console.log(meta);

  if (!width || !height || !format) {
    const err = new Error("Invalid image metadata");
    err.name = "MetadataError";
    throw err;
  }

  if (!supportedOutputImageExtensions.includes(format as any)) {
    const err = new Error("Invalid image format");
    err.name = "ImageFormatError";
    throw err;
  }

  let {
    quality = 100,
    fit = "cover",
    pos = "center",
    kernel = "lanczos3",
    bg = "rgba(0,0,0,0)",
  } = params;
  pos = pos.replace(" ", "") as any;

  const finalParams = {
    width,
    height,
    format: format as SupportedOutputImageExtension,
    quality,
    fit,
    pos,
    kernel,
    bg,
  };

  const key = getKeyForImage(user, id, finalParams);
  // console.log("UPLOADING", key);
  const uploadCmd = new PutObjectCommand({
    Bucket: config.bucket.name,
    Key: key,
    Body: buffer,
    ContentType: `image/${format}`,
  });

  try {
    await s3.send(uploadCmd);
    return finalParams;
  } catch (e: any) {
    throw e;
  }
};

export const getImageFromBucketByKey = async (
  key: string,
  returnType: "buffer" | "stream" | "sharp" = "buffer"
): Promise<Buffer | internal.Readable | Sharp> => {
  const getCmd = new GetObjectCommand({
    Bucket: config.bucket.name,
    Key: key,
  });
  try {
    const { Body } = await s3.send(getCmd);
    if (!Body) {
      const err = new Error("Image does not exist");
      err.name = "ImageDoesNotExist";
      throw err;
    }
    if (returnType === "buffer" || "sharp") {
      const chunks = [];
      for await (const chunk of Body as internal.Readable) {
        chunks.push(chunk);
      }
      const buff = Buffer.concat(chunks);
      if (returnType === "sharp") {
        return sharp(buff);
      } else {
        return buff;
      }
    } else if (returnType === "stream") {
      return Body as internal.Readable;
    } else {
      const err = new Error("Invalid return type");
      err.name = "InvalidReturnType";
      throw err;
    }
  } catch (e: any) {
    if (e.name === "NoSuchKey") {
      const err = new Error("Image does not exist");
      err.name = "ImageDoesNotExist";
      throw err;
    }
    throw e;
  }
};

export const getBestImageByID = async (
  user: string,
  id: string
): Promise<{ img: Sharp; params: ImageParams }> => {
  // Paginate through all images for this ID
  const images = [];
  let marker: string | undefined;
  let isTruncated: boolean = false;

  do {
    const listCmd = new ListObjectsCommand({
      Bucket: config.bucket.name,
      Prefix: `${config.bucket.prefix}${user}/${id}`,
      Marker: marker,
    });
    const { Contents, IsTruncated, NextMarker } = await s3.send(listCmd);
    if (Contents) {
      images.push(...Contents);
    }
    isTruncated = IsTruncated || false;
    marker = NextMarker;
  } while (marker);

  // Sort images by quality and dimensions
  images.sort((a, b) => {
    if (!a.Key || !b.Key) {
      return 0;
    }
    const aParams = getParamsFromKey(a.Key);
    const bParams = getParamsFromKey(b.Key);
    const aPixels = (aParams.width || 1) * (aParams.height || 1);
    const bPixels = (bParams.width || 1) * (bParams.height || 1);
    if (aPixels > bPixels) {
      return -1;
    } else if (aPixels < bPixels) {
      return 1;
    } else {
      if (!aParams.quality || !bParams.quality) {
        return 0;
      }
      if (aParams.quality > bParams.quality) {
        return -1;
      } else if (aParams.quality < bParams.quality) {
        return 1;
      } else {
        return 0;
      }
    }
  });

  // Return the first image
  if (images.length > 0) {
    const image = images[0];
    if (!image.Key) {
      const err = new Error("Image does not exist");
      err.name = "ImageDoesNotExist";
      throw err;
    }
    const sharpImage = (await getImageFromBucketByKey(
      image.Key,
      "sharp"
    )) as Sharp;
    return { img: sharpImage, params: getParamsFromKey(image.Key) };
  }

  const err = new Error("Image does not exist");
  err.name = "ImageDoesNotExist";
  throw err;
};

export const deleteImageFromBucketByKey = async (
  key: string
): Promise<void> => {
  const deleteCmd = new DeleteObjectCommand({
    Bucket: config.bucket.name,
    Key: key,
  });
  try {
    await s3.send(deleteCmd);
  } catch (e: any) {
    throw e;
  }
};
