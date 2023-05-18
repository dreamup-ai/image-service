import {
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { Item } from "dynamo-tools";
import sharp, { Sharp } from "sharp";
import internal from "stream";
import { client as dynamo } from "./clients/dynamo";
import { client as s3 } from "./clients/s3";
import config from "./config";
import {
  CacheEntry,
  ImageParams,
  SupportedOutputImageExtension,
  coerceImageParams,
  supportedOutputImageExtensions,
} from "./types";

const { imageTable } = config.db;

const coerceObjectToCacheEntry = (obj: any): CacheEntry => {
  if (obj.id_public && obj.id_public.endsWith(":1")) {
    obj.public = true;
  } else {
    obj.public = false;
  }
  delete obj.id_public;

  return obj;
};

export const checkCacheForUrl = async (
  url: string
): Promise<CacheEntry | null> => {
  const queryCmd = new QueryCommand({
    TableName: imageTable,
    IndexName: "url",
    KeyConditionExpression: "#url = :url",
    ExpressionAttributeNames: {
      "#url": "url",
    },
    ExpressionAttributeValues: {
      ":url": Item.fromObject(url),
    },
  });

  const { Items } = await dynamo.send(queryCmd);
  if (!Items || !Items.length) {
    return null;
  }
  const cachedUrl = Item.toObject(Items[0]);
  return coerceObjectToCacheEntry(cachedUrl);
};

export const addUrlToCache = async (url: string, id: string): Promise<void> => {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const createCmd = new PutItemCommand({
    TableName: imageTable,
    Item: Item.fromObject({
      id,
      url,
      exp: nowInSeconds + config.db.urlCacheTTLSeconds,
      id_public: `${id}:1`, // All web images are considered public by default.
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

export const makeImagePublic = async (id: string): Promise<void> => {
  const updateCmd = new UpdateItemCommand({
    TableName: imageTable,
    Key: Item.fromObject({ id }),
    UpdateExpression: "SET #public = :public",
    ExpressionAttributeNames: {
      "#public": "id_public",
    },
    ExpressionAttributeValues: {
      ":public": Item.fromObject(`${id}:1`),
    },
    ReturnValues: "NONE",
    ConditionExpression: "attribute_exists(id)",
  });

  try {
    await dynamo.send(updateCmd);
  } catch (e: any) {
    if (e.name === "ConditionalCheckFailedException") {
      const err = new Error("Image does not exist");
      err.name = "ImageDoesNotExist";
      throw err;
    }
    throw e;
  }
};

export const makeImagePrivate = async (id: string): Promise<void> => {
  const updateCmd = new UpdateItemCommand({
    TableName: imageTable,
    Key: Item.fromObject({ id }),
    UpdateExpression: "SET #public = :public",
    ExpressionAttributeNames: {
      "#public": "id_public",
    },
    ExpressionAttributeValues: {
      ":public": Item.fromObject(`${id}:0`),
    },
    ReturnValues: "NONE",
    ConditionExpression: "attribute_exists(id)",
  });

  try {
    await dynamo.send(updateCmd);
  } catch (e: any) {
    if (e.name === "ConditionalCheckFailedException") {
      const err = new Error("Image does not exist");
      err.name = "ImageDoesNotExist";
      throw err;
    }
    throw e;
  }
};

export const createNewImageInCache = async (
  user: string,
  id: string,
  originalKey: string,
  isPublic: boolean
): Promise<void> => {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const createCmd = new PutItemCommand({
    TableName: imageTable,
    Item: Item.fromObject({
      id,
      user,
      original_key: originalKey,
      created: nowInSeconds,
      id_public: `${id}:${isPublic ? 1 : 0}`,
      exp: Number.MAX_SAFE_INTEGER,
    }),
    ConditionExpression: "attribute_not_exists(id)",
  });

  try {
    await dynamo.send(createCmd);
  } catch (e: any) {
    if (e.name === "ConditionalCheckFailedException") {
      const err = new Error("Image already exists");
      err.name = "ImageAlreadyExists";
      throw err;
    }
    throw e;
  }
};

export const getImageFromCacheById = async (
  id: string
): Promise<CacheEntry | null> => {
  const getCmd = new GetItemCommand({
    TableName: imageTable,
    Key: Item.fromObject({ id }),
  });

  const { Item: item } = await dynamo.send(getCmd);
  if (!item) {
    return null;
  }
  const image = Item.toObject(item);

  return coerceObjectToCacheEntry(image);
};

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
  // Check cache for original key
  const cacheRecord = await getImageFromCacheById(id);
  if (!cacheRecord) {
    const err = new Error("Image does not exist");
    err.name = "ImageDoesNotExist";
    throw err;
  }

  const img = (await getImageFromBucketByKey(
    cacheRecord.original_key,
    "sharp"
  )) as Sharp;
  const params = getParamsFromKey(cacheRecord.original_key);
  return { img, params };
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
