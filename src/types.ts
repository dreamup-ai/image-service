import { FromSchema, JSONSchema7 } from "json-schema-to-ts";
import { Sharp, FormatEnum } from "sharp";

export const deletedResponseSchema = {
  type: "object",
  properties: {
    deleted: {
      type: "boolean",
      default: true,
    },
    id: {
      type: "string",
      format: "uuid4",
    },
  },
} as const satisfies JSONSchema7;

export type DeletedResponse = FromSchema<typeof deletedResponseSchema>;

export const errorResponseSchema = {
  type: "object",
  properties: {
    error: {
      type: "string",
    },
  },
} as const satisfies JSONSchema7;

export type ErrorResponse = FromSchema<typeof errorResponseSchema>;

export const paginationTokenSchema = {
  type: "string",
  description: "A token to be used in the next request to get the next page",
  nullable: true,
} as const satisfies JSONSchema7;

export type PaginationToken = FromSchema<typeof paginationTokenSchema>;

export const signatureHeaderSchema = {
  type: "object",
  properties: {},
  patternProperties: {
    "^x-w+-signature$": {
      type: "string",
    },
  },
} as const satisfies JSONSchema7;

export type SignatureHeader = FromSchema<typeof signatureHeaderSchema>;

export const idParamSchema = {
  type: "object",
  required: ["id"],
  properties: {
    id: {
      type: "string",
    },
  },
} as const satisfies JSONSchema7;

export type IdParam = FromSchema<typeof idParamSchema>;

export const supportedInputImageExtensions = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "tiff",
  "apng",
  "heic",
  "heif",
] as const;

export type SupportedImageExtension =
  (typeof supportedInputImageExtensions)[number];

export const supportedOutputImageExtensions = [
  "jpeg",
  "png",
  "webp",
  "tiff",
  "gif",
  "jp2",
  "avif",
  "heif",
  "jxl",
  "raw",
] as const;

export type SupportedOutputImageExtension =
  (typeof supportedOutputImageExtensions)[number];

export const imageUrlSchema = {
  type: "object",
  required: ["id", "ext"],
  properties: {
    id: {
      type: "string",
      format: "uuid4",
    },
    ext: {
      type: "string",
      enum: supportedOutputImageExtensions,
    },
  },
} as const satisfies JSONSchema7;

export type ImageUrl = FromSchema<typeof imageUrlSchema>;

export const imageQueryParamsSchema = {
  type: "object",
  properties: {
    w: {
      type: "number",
      minimum: 1,
      description: "The width of the image",
    },
    h: {
      type: "number",
      minimum: 1,
      description: "The height of the image",
    },
    q: {
      type: "number",
      minimum: 1,
      maximum: 100,
      description: "The quality of the image",
    },
    ext: {
      type: "string",
      enum: supportedInputImageExtensions,
    },
  },
} as const satisfies JSONSchema7;

export type ImageQueryParams = FromSchema<typeof imageQueryParamsSchema>;

export const imageVersionSchema = {
  type: "object",
  description: "Describes a version of the image",
  required: ["w", "h", "ext", "q", "key"],
  properties: {
    ...imageQueryParamsSchema.properties,
    key: {
      type: "string",
      description: "The key of the image in the image bucket",
    },
  },
} as const satisfies JSONSchema7;

export type ImageVersion = FromSchema<typeof imageVersionSchema>;

export const imageSchema = {
  type: "object",
  required: ["user", "versions"],
  properties: {
    id: {
      type: "string",
      format: "uuid4",
      description: "The unique identifier for the image",
    },
    user: {
      type: "string",
      format: "uuid4",
      description: "The unique identifier for the user that owns the image",
    },
    url: {
      type: "string",
      format: "uri",
      description: "The URL to the image",
    },
    versions: {
      type: "array",
      items: imageVersionSchema,
    },
  },
} as const satisfies JSONSchema7;

export type Image = FromSchema<typeof imageSchema>;
