import { S3Client } from "@aws-sdk/client-s3";
import config from "../config";

export const client = new S3Client({
  region: config.aws.region,
  endpoint: config.aws.endpoints.s3,
});
