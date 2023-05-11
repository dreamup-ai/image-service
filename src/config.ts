import assert from "assert";
import crypto from "crypto";
import * as dotenv from "dotenv";
import fs from "fs";
import { version } from "../package.json";
dotenv.config({ override: true, path: `./.env.${process.env.APP_ENV}` });
const {
  AWS_REGION,
  AWS_DEFAULT_REGION = "us-east-1",
  DYNAMODB_ENDPOINT,
  S3_ENDPOINT,
  IMAGE_TABLE,
  URL_CACHE_TTL_SECONDS = "86400", // 1 day
  IMAGE_BUCKET,
  IMAGE_BUCKET_PREFIX = "",
  PORT = "3000",
  HOST = "localhost",
  PUBLIC_URL = "http://localhost:3000",
  WEBHOOK_PUBLIC_KEY_PATH,
  WEBHOOK_PRIVATE_KEY_PATH,
  WEBHOOK_SIG_HEADER = "x-dreamup-signature",
  DREAMUP_SESSION_COOKIE_NAME = "dreamup_session",
  SESSION_PUBLIC_KEY_URL,
  SESSION_LOGIN_URL,
} = process.env;

assert(IMAGE_TABLE, "IMAGE_TABLE is required");
assert(IMAGE_BUCKET, "IMAGE_BUCKET is required");
assert(WEBHOOK_PUBLIC_KEY_PATH, "WEBHOOK_PUBLIC_KEY_PATH is required");
assert(WEBHOOK_PRIVATE_KEY_PATH, "WEBHOOK_PRIVATE_KEY_PATH is required");
assert(SESSION_PUBLIC_KEY_URL, "SESSION_PUBLIC_KEY_URL is required");
assert(SESSION_LOGIN_URL, "SESSION_LOGIN_URL is required");

const rawWebhookPublicKey = fs.readFileSync(WEBHOOK_PUBLIC_KEY_PATH, "utf8");
const webhookPublicKey = crypto.createPublicKey(rawWebhookPublicKey);
const rawWebhookPrivateKey = fs.readFileSync(WEBHOOK_PRIVATE_KEY_PATH, "utf8");
const webhookPrivateKey = crypto.createPrivateKey(rawWebhookPrivateKey);

type config = {
  aws: {
    region: string;
    endpoints: {
      dynamodb: string | undefined;
      s3: string | undefined;
    };
  };
  db: {
    imageTable: string;
    urlCacheTTLSeconds: number;
  };
  bucket: {
    name: string;
    prefix: string;
  };
  server: {
    port: number;
    host: string;
    publicUrl: string;
    version: string;
  };
  webhooks: {
    events: {
      [x: string]: string[];
    };
    publicKey: crypto.KeyObject;
    privateKey: crypto.KeyObject;
    signatureHeader: string;
  };
  session: {
    publicKey: () => Promise<crypto.KeyObject>;
    cookieName: string;
    loginUrl: string;
  };
};

let sessionKey: crypto.KeyObject | undefined;

const config: config = {
  aws: {
    region: AWS_REGION || AWS_DEFAULT_REGION,
    endpoints: {
      dynamodb: DYNAMODB_ENDPOINT,
      s3: S3_ENDPOINT,
    },
  },
  db: {
    imageTable: IMAGE_TABLE,
    urlCacheTTLSeconds: parseInt(URL_CACHE_TTL_SECONDS, 10),
  },
  bucket: {
    name: IMAGE_BUCKET,
    prefix: IMAGE_BUCKET_PREFIX,
  },
  server: {
    port: parseInt(PORT, 10),
    host: HOST,
    publicUrl: PUBLIC_URL,
    version,
  },
  webhooks: {
    events: {},
    publicKey: webhookPublicKey,
    privateKey: webhookPrivateKey,
    signatureHeader: WEBHOOK_SIG_HEADER,
  },
  session: {
    publicKey: async () => {
      if (!sessionKey) {
        // This is a JWK endpoint, so we need to fetch the key from the URL
        const res = await fetch(SESSION_PUBLIC_KEY_URL);
        const jwk = await res.json();
        sessionKey = crypto.createPublicKey(jwk);
      }
      return sessionKey;
    },
    cookieName: DREAMUP_SESSION_COOKIE_NAME,
    loginUrl: SESSION_LOGIN_URL,
  },
};

const imageCreateHooks = Object.keys(process.env)
  .filter((x) => x.startsWith("WEBHOOK_IMAGE_CREATE") && process.env[x])
  .map((x) => process.env[x]) as string[];
if (imageCreateHooks.length > 0) {
  config.webhooks.events["pipeline.create"] = imageCreateHooks;
}

const imageUpdateHooks = Object.keys(process.env)
  .filter((x) => x.startsWith("WEBHOOK_IMAGE_UPDATE") && process.env[x])
  .map((x) => process.env[x]) as string[];
if (imageUpdateHooks.length > 0) {
  config.webhooks.events["pipeline.update"] = imageUpdateHooks;
}

const imageDeleteHooks = Object.keys(process.env)
  .filter((x) => x.startsWith("WEBHOOK_IMAGE_DELETE") && process.env[x])
  .map((x) => process.env[x]) as string[];
if (imageDeleteHooks.length > 0) {
  config.webhooks.events["pipeline.delete"] = imageDeleteHooks;
}

export default config;
