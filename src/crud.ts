import {
  DeleteItemCommand,
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
import { FastifyBaseLogger } from "fastify";
import sharp, { Sharp } from "sharp";
import internal from "stream";
import { v4 as uuidv4 } from "uuid";
import { client as dynamo } from "./clients/dynamo";
import { client as s3 } from "./clients/s3";
import config from "./config";
import { Image, ImageVersion, SupportedImageExtension } from "./types";
import { sendWebhook } from "./webhooks";

const { imageTable } = config.db;

export const createNewImageInDb = async (
  image: Image,
  log: FastifyBaseLogger
): Promise<Image> => {
  if (!image.id) {
    image.id = uuidv4();
  }
  if (!image.versions || !image.versions.length) {
    throw new Error("Cannot create image without versions");
  }

  const createCmd = new PutItemCommand({
    TableName: imageTable,
    Item: Item.fromObject(image),
    ConditionExpression: "attribute_not_exists(id)",
  });

  try {
    await dynamo.send(createCmd);

    sendWebhook("image.created", image, log);
    return image;
  } catch (e: any) {
    if (e.name === "ConditionalCheckFailedException") {
      const err = new Error("Image already exists");
      err.name = "ImageAlreadyExists";
      throw err;
    }
    throw e;
  }
};

export const addNewImageVersionToDb = async (
  id: string,
  version: ImageVersion,
  log: FastifyBaseLogger
): Promise<Image> => {
  const updateCmd = new UpdateItemCommand({
    TableName: imageTable,
    Key: Item.fromObject({ id }),
    UpdateExpression: "SET #versions = list_append(#versions, :version)",
    ExpressionAttributeNames: {
      "#versions": "versions",
    },
    ExpressionAttributeValues: {
      ":version": Item.fromObject([version]),
    },
    ReturnValues: "ALL_NEW",
    ConditionExpression: "attribute_exists(id)",
  });

  try {
    const { Attributes } = await dynamo.send(updateCmd);
    const updatedImg = Item.toObject(Attributes) as Image;
    sendWebhook("image.updated", updatedImg, log);
    return updatedImg;
  } catch (e: any) {
    if (e.name === "ConditionalCheckFailedException") {
      const err = new Error("Image does not exist");
      err.name = "ImageDoesNotExist";
      throw err;
    }
    throw e;
  }
};

export const getImageFromDbById = async (
  id: string,
  log: FastifyBaseLogger
): Promise<Image | null> => {
  const getCmd = new GetItemCommand({
    TableName: imageTable,
    Key: Item.fromObject({ id }),
  });

  const { Item: item } = await dynamo.send(getCmd);
  if (!item) {
    return null;
  }
  const image = Item.toObject(item) as Image;
  return image;
};

export const getImageFromDbByUrl = async (
  url: string,
  log: FastifyBaseLogger
): Promise<Image | null> => {
  const getCmd = new QueryCommand({
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

  const { Items } = await dynamo.send(getCmd);
  if (!Items || !Items.length) {
    return null;
  }
  const image = Item.toObject(Items[0]) as Image;
  return image;
};

export const deleteImageFromDb = async (
  id: string,
  log: FastifyBaseLogger
): Promise<void> => {
  const deleteCmd = new DeleteItemCommand({
    TableName: imageTable,
    Key: Item.fromObject({ id }),
    ReturnValues: "ALL_OLD",
    ConditionExpression: "attribute_exists(id)",
  });

  try {
    const { Attributes } = await dynamo.send(deleteCmd);
    const image = Item.toObject(Attributes) as Image;
    sendWebhook("image.deleted", image, log);
  } catch (e: any) {
    if (e.name === "ConditionalCheckFailedException") {
      const err = new Error("Image does not exist");
      err.name = "ImageDoesNotExist";
      throw err;
    }
    throw e;
  }
};

export const uploadImageToBucket = async (
  id: string,
  image: Sharp,
  quality: number = 100,
  fit: "cover" | "contain" | "fill" | "inside" | "outside" = "cover",
  pos:
    | "top"
    | "right top"
    | "right"
    | "right bottom"
    | "bottom"
    | "left bottom"
    | "left"
    | "left top"
    | "north"
    | "northeast"
    | "east"
    | "southeast"
    | "south"
    | "southwest"
    | "west"
    | "northwest"
    | "center"
    | "centre"
    | "entropy"
    | "attention" = "center"
): Promise<ImageVersion> => {
  const buffer = await image.toBuffer();
  const meta = await image.metadata();
  const { width, height, format } = meta;

  if (!width || !height || !format) {
    const err = new Error("Invalid image metadata");
    err.name = "MetadataError";
    throw err;
  }

  const key = `${config.bucket.prefix}${id}-${width}x${height}-q${quality}-${fit}-${pos}.${format}`;
  const uploadCmd = new PutObjectCommand({
    Bucket: config.bucket.name,
    Key: key,
    Body: buffer,
    ContentType: `image/${format}`,
  });

  try {
    await s3.send(uploadCmd);
    return {
      w: width,
      h: height,
      q: quality,
      key,
      ext: format as SupportedImageExtension,
      fit,
      pos: pos.replace(" ", "") as any,
    };
  } catch (e: any) {
    throw e;
  }
};

export const getImageFromBucket = async (
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
    throw e;
  }
};

export const deleteImageFromBucket = async (key: string): Promise<void> => {
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
