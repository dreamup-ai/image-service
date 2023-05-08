import crypto from "node:crypto";

import { FastifyInstance } from "fastify";
import { Cache } from "dynamo-tools";
import jwt from "jsonwebtoken";
import sinon from "sinon";

import config from "../src/config";
import { build } from "../src/server";
import { client as s3 } from "../src/clients/s3";

import { ListObjectsCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

import {
  createTable,
  deleteTable,
  createBucket,
  deleteBucket,
} from "../init-local-aws";

export { createTable, deleteTable, createBucket, deleteBucket };

const cache = new Cache({
  region: config.aws.region,
  endpoint: config.aws.endpoints.dynamodb,
});

const sandbox = sinon.createSandbox();

export const clearTable = async () => {
  await cache.deleteAll({ table: config.db.imageTable });
};

export const clearBucket = async () => {
  const { Contents } = await s3.send(
    new ListObjectsCommand({
      Bucket: config.bucket.name,
    })
  );
  if (Contents) {
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
};

let server: FastifyInstance;
export const getServer = async () => {
  if (!server) {
    server = await build({ logger: false });
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
