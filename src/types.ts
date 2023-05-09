import { FromSchema, JSONSchema7 } from "json-schema-to-ts";
// import { Sharp, FormatEnum } from "sharp";

export const deletedResponseSchema = {
  type: "object",
  properties: {
    deleted: {
      type: "boolean",
      default: true,
    },
    id: {
      type: "string",
      format: "uuid",
    },
  },
} as const satisfies JSONSchema7;

export type DeletedResponse = FromSchema<typeof deletedResponseSchema>;

export const errorResponseSchema = {
  type: "object",
  description: "An error response",
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
      format: "uuid",
    },
    ext: {
      type: "string",
      enum: supportedOutputImageExtensions,
    },
  },
} as const satisfies JSONSchema7;

export type ImageUrl = FromSchema<typeof imageUrlSchema>;

// export const imageVersionSchema = {
//   type: "object",
//   description: "Describes a version of the image",
//   required: ["w", "h", "ext", "q", "key"],
//   properties: {
//     ...imageQueryParamsSchema.properties,
//     key: {
//       type: "string",
//       description: "The key of the image in the image bucket",
//     },
//   },
// } as const satisfies JSONSchema7;

// export type ImageVersion = FromSchema<typeof imageVersionSchema>;

// export const imageSchema = {
//   type: "object",
//   required: ["user", "versions"],
//   properties: {
//     id: {
//       type: "string",
//       format: "uuid",
//       description: "The unique identifier for the image",
//     },
//     user: {
//       type: "string",
//       format: "uuid",
//       description: "The unique identifier for the user that owns the image",
//     },
//     url: {
//       type: "string",
//       format: "uri",
//       description: "The URL to the image",
//     },
//     versions: {
//       type: "array",
//       items: imageVersionSchema,
//     },
//   },
// } as const satisfies JSONSchema7;

// export type Image = FromSchema<typeof imageSchema>;

export const imageUploadSchema = {
  type: "object",
  properties: {
    url: {
      type: "string",
      format: "uri",
    },
    image: {
      type: "string",
      format: "byte",
      description: "The image to upload in base64 format",
    },
    force: {
      type: "boolean",
      default: false,
      description:
        "Re-upload the image, even if it's cached already. Only used in conjunction with the `url` field",
    },
  },
} as const satisfies JSONSchema7;

export type ImageUpload = FromSchema<typeof imageUploadSchema>;

export const cachedUrlSchema = {
  type: "object",
  required: ["url", "id", "exp"],
  properties: {
    url: {
      type: "string",
      format: "uri",
      description: "The URL to the image",
    },
    id: {
      type: "string",
      format: "uuid",
      description: "The unique identifier for the image",
    },
    exp: {
      type: "number",
      description:
        "The time at which the cached URL expires, expressed in SECONDS since the UNIX epoch",
    },
  },
} as const satisfies JSONSchema7;

export type CachedUrl = FromSchema<typeof cachedUrlSchema>;

export const imageDimensionSchema = {
  type: "number",
  minimum: 1,
} as const satisfies JSONSchema7;

export const imageResizeOptionsSchema = {
  type: "object",
  description: "Options for resizing an image",
  required: [],
  properties: {
    width: imageDimensionSchema,
    height: imageDimensionSchema,
    fit: {
      type: "string",
      description: `When both a width and height are provided, the possible methods by which the image should fit these are:
      - \`cover\` (default) Preserving aspect ratio, attempt to ensure the image covers both provided dimensions by cropping/clipping to fit.
      - \`contain\` Preserving aspect ratio, contain within both provided dimensions using "letterboxing" where necessary.
      - \`fill\` Ignore the aspect ratio of the input and stretch to both provided dimensions.
      - \`inside\` Preserving aspect ratio, resize the image to be as large as possible while ensuring its dimensions are less than or equal to both those specified.
      - \`outside\` Preserving aspect ratio, resize the image to be as small as possible while ensuring its dimensions are greater than or equal to both those specified.

      See https://sharp.pixelplumbing.com/api-resize#resize for more information
      `,
      enum: ["cover", "contain", "fill", "inside", "outside"],
      default: "cover",
    },
    pos: {
      type: "string",
      description: `When both a width and height are provided, there are many possible ways to crop the image. The \`pos\` parameter controls how the image is cropped. The default is \`center\`.`,
      enum: [
        "top",
        "righttop",
        "right",
        "rightbottom",
        "bottom",
        "leftbottom",
        "left",
        "lefttop",
        "north",
        "northeast",
        "east",
        "southeast",
        "south",
        "southwest",
        "west",
        "northwest",
        "center",
        "centre",
        "entropy",
        "attention",
      ],
      default: "center",
    },
    bg: {
      type: "string",
      description:
        "The background colour to use when using a fit of `cover` or `contain`. Should be in rgb(r,g,b) or rgba(r,g,b,a) format.",
      pattern:
        "^rgba\\((\\d{1,3}),(\\d{1,3}),(\\d{1,3}),(\\d.?\\d?)\\)$|^rgb\\((\\d{1,3}),(\\d{1,3}),(\\d{1,3})\\)$",
      default: "rgba(0,0,0,0)",
    },
    kernel: {
      type: "string",
      description: "The kernel to use for image reduction.",
      enum: ["nearest", "cubic", "mitchell", "lanczos2", "lanczos3"],
      default: "lanczos3",
    },
  },
} as const satisfies JSONSchema7;

export type ImageResizeOptions = FromSchema<typeof imageResizeOptionsSchema>;

export const imageQualitySchema = {
  type: "number",
  minimum: 1,
  maximum: 100,
  description: "The quality of the image.",
  default: 100,
} as const satisfies JSONSchema7;

export type ImageQuality = FromSchema<typeof imageQualitySchema>;

export const commonImageExportOptionsSchema = {
  type: "object",
  description: "Options for exporting an image",
  properties: {
    format: {
      type: "string",
      enum: supportedOutputImageExtensions,
    },
    quality: imageQualitySchema,
  },
} as const satisfies JSONSchema7;

export type CommonImageExportOptions = FromSchema<
  typeof commonImageExportOptionsSchema
>;

export const urlShortenOptionsSchema = {
  type: "object",
  description: "Options for shortening a URL",
  required: [],
  properties: {
    pos: {
      type: "string",
      description: "Shortened versions of the position parameter",
      enum: [
        "rt",
        "r",
        "rb",
        "b",
        "lb",
        "l",
        "lt",
        "n",
        "ne",
        "e",
        "se",
        "s",
        "sw",
        "w",
        "nw",
        "c",
      ],
    },
    w: {
      ...imageDimensionSchema,
      description: "Shortened version of the width parameter",
    },
    h: {
      ...imageDimensionSchema,
      description: "Shortened version of the height parameter",
    },
    q: {
      ...imageQualitySchema,
      description: "Shortened version of the quality parameter",
    },
  },
} as const satisfies JSONSchema7;

export type UrlShortenOptions = FromSchema<typeof urlShortenOptionsSchema>;

export const imageParamsSchema = {
  allOf: [commonImageExportOptionsSchema, imageResizeOptionsSchema],
} as const satisfies JSONSchema7;

export type ImageParams = FromSchema<typeof imageParamsSchema>;

const allPosOptions = [
  ...imageResizeOptionsSchema.properties.pos.enum,
  ...urlShortenOptionsSchema.properties.pos.enum,
];
export const imageQueryParamsSchema = {
  type: "object",
  description: "Query parameters for fetching an image",
  required: [],
  properties: {
    ...imageResizeOptionsSchema.properties,
    ...commonImageExportOptionsSchema.properties,
    ...urlShortenOptionsSchema.properties,
    pos: {
      ...imageResizeOptionsSchema.properties.pos,
      enum: allPosOptions,
    },
  },
} as const satisfies JSONSchema7;

export type ImageQueryParams = FromSchema<typeof imageQueryParamsSchema>;
