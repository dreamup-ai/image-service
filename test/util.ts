import crypto from "node:crypto";

import { Cache } from "dynamo-tools";
import { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import sinon from "sinon";

import { client as s3 } from "../src/clients/s3";
import config from "../src/config";
import { build } from "../src/server";

import { DeleteObjectCommand, ListObjectsCommand } from "@aws-sdk/client-s3";
import fs from "node:fs";
import path from "node:path";

import { Sharp } from "sharp";
import {
  createBucket,
  createTable,
  deleteBucket,
  deleteTable,
} from "../init-local-aws";

export { createBucket, createTable, deleteBucket, deleteTable };

const { TEST_OUTPUT_DIR = "test-output-images" } = process.env;

fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });

export const writeOutputImage = async (image: Sharp, url: string) => {
  let resourceId = url.split("/").pop()!;
  let [filename, params] = resourceId.split("?");
  let [imageId, ext] = filename.split(".");
  fs.writeFileSync(
    path.join(
      TEST_OUTPUT_DIR,
      `${imageId}${params ? "_" : ""}${params || ""}.${ext}`
    ),
    await image.toBuffer()
  );
};

const cache = new Cache({
  region: config.aws.region,
  endpoint: config.aws.endpoints.dynamodb,
});

const sandbox = sinon.createSandbox();

export const clearTable = async () => {
  await cache.deleteAll({ table: config.db.imageTable });
};

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const clearBucket = async () => {
  let contents;
  do {
    const { Contents } = await s3.send(
      new ListObjectsCommand({
        Bucket: config.bucket.name,
      })
    );

    contents = Contents || [];
    if (Contents && Contents.length > 0) {
      await Promise.all(
        Contents.map((c) =>
          s3.send(
            new DeleteObjectCommand({
              Bucket: config.bucket.name,
              Key: c.Key,
            })
          )
        )
      );
    }
  } while (contents.length > 0);
};

let server: FastifyInstance;
export const getServer = async () => {
  if (!server) {
    server = await build({ logger: false, bodyLimit: 1024 * 1024 });
  }
  return server;
};

export function sign(
  payload: string,
  privateKey: crypto.KeyObject = config.webhooks.privateKey
) {
  const signature = crypto.sign("sha256", Buffer.from(payload), privateKey);
  return signature.toString("base64");
}

before(async () => {
  await createTable();
  await createBucket();

  sandbox.restore();
  sandbox.stub(config.session, "publicKey").resolves(config.webhooks.publicKey);
});

after(async () => {
  await deleteTable();

  /**
   * The server does image uploads after returning a response to the user, so tests complete
   * we have to wait a moment for the uploads to complete, so we don't end up trying to delete
   * a non-empty bucket
   **/
  await sleep(500);
  await clearBucket();
  await deleteBucket();
  sandbox.restore();
});

export const issueSession = (userId: string, sessionId: string) => {
  const token = jwt.sign(
    {
      userId,
      sessionId,
    },
    config.webhooks.privateKey,
    {
      expiresIn: "24h",
      algorithm: "RS256",
    }
  );
  return token;
};
