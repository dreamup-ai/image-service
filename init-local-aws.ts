import * as dotenv from "dotenv";
dotenv.config({ override: true, path: `./.env.${process.env.APP_ENV}` });

import {
  CreateTableCommand,
  DeleteTableCommand,
} from "@aws-sdk/client-dynamodb";
import config from "./src/config";
import { client as dynamo } from "./src/clients/dynamo";
import { client as s3 } from "./src/clients/s3";
import { CreateBucketCommand, DeleteBucketCommand } from "@aws-sdk/client-s3";

export const deleteTable = async () => {
  await dynamo.send(
    new DeleteTableCommand({
      TableName: config.db.imageTable,
    })
  );
};

export const createTable = async () => {
  try {
    await dynamo.send(
      new CreateTableCommand({
        TableName: config.db.imageTable,
        AttributeDefinitions: [
          {
            AttributeName: "id",
            AttributeType: "S",
          },
          {
            AttributeName: "user",
            AttributeType: "S",
          },
          {
            AttributeName: "created",
            AttributeType: "N",
          },
        ],
        KeySchema: [
          {
            AttributeName: "id",
            KeyType: "HASH",
          },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: "user",
            KeySchema: [
              {
                AttributeName: "user",
                KeyType: "HASH",
              },
              {
                AttributeName: "created",
                KeyType: "RANGE",
              },
            ],
            Projection: {
              ProjectionType: "ALL",
            },
          },
        ],
        BillingMode: "PAY_PER_REQUEST",
      })
    );
  } catch (e: any) {
    if (e.name === "ResourceInUseException") {
      console.log("Table already exists");
    } else {
      throw e;
    }
  }
};

export const createBucket = async () => {
  const cmd = new CreateBucketCommand({
    Bucket: config.bucket.name,
  });
  try {
    await s3.send(cmd);
  } catch (e: any) {
    if (e.name === "BucketAlreadyOwnedByYou") {
      /**
       * This error is thrown when the bucket already exists and is owned by you.
       * This error is returned in every region EXCEPT us-east-1 (north virginia).
       *
       * For legacy compatibility, if you re-create an existing bucket that you
       * already own in the North Virginia Region, Amazon S3 returns 200 OK and
       * resets the bucket access control lists (ACLs).
       */
      console.log("Bucket already exists");
    } else {
      console.log(e);
      throw e;
    }
  }
};

export const deleteBucket = async () => {
  await s3.send(
    new DeleteBucketCommand({
      Bucket: config.bucket.name,
    })
  );
};
