import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import config from "../config";

export const client = new DynamoDBClient({
  region: config.aws.region,
  endpoint: config.aws.endpoints.dynamodb,
});
