import { FromSchema, JSONSchema7 } from "json-schema-to-ts";

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

export const imageVersionSchema = {
  type: "object",
  description: "Describes a version of the image",
  required: ["w", "h", "ext", "q", "key"],
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
    ext: {
      type: "string",
      enum: [
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
      ],
    },
    q: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "The quality of the image",
    },
    key: {
      type: "string",
      description: "The key of the image in the image bucket",
    },
  },
} as const satisfies JSONSchema7;

export const imageSchema = {
  type: "object",
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
