import * as dotenv from "dotenv";
dotenv.config({ override: true, path: `./.env.${process.env.APP_ENV}` });

import {
  CreateTableCommand,
  DeleteTableCommand,
  UpdateTimeToLiveCommand,
} from "@aws-sdk/client-dynamodb";
import { CreateBucketCommand, DeleteBucketCommand } from "@aws-sdk/client-s3";
import { client as dynamo } from "./src/clients/dynamo";
import { client as s3 } from "./src/clients/s3";
import config from "./src/config";

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
            AttributeName: "url",
            AttributeType: "S",
          },
          {
            AttributeName: "exp",
            AttributeType: "N",
          },
        ],
        KeySchema: [
          {
            AttributeName: "url",
            KeyType: "HASH",
          },
          {
            AttributeName: "exp",
            KeyType: "RANGE",
          },
        ],
        BillingMode: "PAY_PER_REQUEST",
      })
    );

    await dynamo.send(
      new UpdateTimeToLiveCommand({
        TableName: config.db.imageTable,
        TimeToLiveSpecification: {
          AttributeName: "exp",
          Enabled: true,
        },
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
