import Ajv from "ajv";
import { FromSchema, JSONSchema7 } from "json-schema-to-ts";

const laxValidator = new Ajv();
const cleanValidator = new Ajv({
  removeAdditional: "all",
});
const coerceValidator = new Ajv({
  coerceTypes: true,
});

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

export type SupportedInputImageExtension =
  (typeof supportedInputImageExtensions)[number];

export const outputImageFormats = [
  "jpeg",
  "png",
  "webp",
  "tiff",
  "avif",
] as const;

export type OutputImageFormat = (typeof outputImageFormats)[number];

export const supportedOutputImageExtensions = [
  ...outputImageFormats,
  "jpg",
] as const;

export type SupportedOutputImageExtension =
  (typeof supportedOutputImageExtensions)[number];

export const extensionToFormatMap = {
  jpg: "jpeg",
} as const;

export const getFormatFromExtension = (
  ext: SupportedOutputImageExtension
): OutputImageFormat => {
  if (extensionToFormatMap.hasOwnProperty(ext)) {
    return extensionToFormatMap[ext as keyof typeof extensionToFormatMap];
  }
  return ext as OutputImageFormat;
};

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

export const imageUploadResponseSchema = {
  type: "object",
  required: ["id"],
  properties: {
    id: {
      type: "string",
      format: "uuid",
    },
  },
} as const satisfies JSONSchema7;

export type ImageUploadResponse = FromSchema<typeof imageUploadResponseSchema>;

export const cacheEntrySchema = {
  type: "object",
  required: ["id", "original_key", "user"],
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
    public: {
      type: "boolean",
      default: false,
    },
    original_key: {
      type: "string",
      description: "The bucket key of the original image",
    },
    user: {
      type: "string",
      description: "The user who uploaded the image",
      default: "anonymous",
    },
  },
} as const satisfies JSONSchema7;

export type CacheEntry = FromSchema<typeof cacheEntrySchema>;

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

/**
 * Map of shortened position options to their full names
 */
export const positionMap = {
  righttop: "right top",
  rightbottom: "right bottom",
  leftbottom: "left bottom",
  lefttop: "left top",
  rt: "right top",
  r: "right",
  rb: "right bottom",
  b: "bottom",
  lb: "left bottom",
  l: "left",
  lt: "left top",
  n: "north",
  ne: "northeast",
  e: "east",
  se: "southeast",
  s: "south",
  sw: "southwest",
  w: "west",
  nw: "northwest",
  c: "center",
};

export const getFullPositionName = (position: string) => {
  if (positionMap.hasOwnProperty(position)) {
    return positionMap[position as keyof typeof positionMap];
  }
  return position;
};

const allPosOptions = [
  ...imageResizeOptionsSchema.properties.pos.enum,
  ...urlShortenOptionsSchema.properties.pos.enum,
];

export const optimiseCodingSchema = {
  type: "boolean",
  description: "Optimise Huffman coding tables",
  default: true,
} as const satisfies JSONSchema7;

export const optimiseScansSchema = {
  type: "boolean",
  description: "Optimise progressive scans, forces progressive",
  default: false,
} as const satisfies JSONSchema7;

export const quantisationTableSchema = {
  type: "integer",
  description: "Quantization table to use, integer 0-8",
  minimum: 0,
  maximum: 8,
  default: 0,
} as const satisfies JSONSchema7;

export const progressiveScanSchema = {
  type: "boolean",
  description: "Use progressive (interlace) scan",
  default: false,
} as const satisfies JSONSchema7;

export const numColorsSchema = {
  type: "integer",
  description:
    "Maximum number of palette entries to use. Sets palette to true.",
  minimum: 2,
  maximum: 256,
} as const satisfies JSONSchema7;

export const chromaSubsamplingSchema = {
  type: "string",
  description: "Set to '4:4:4' to prevent chroma subsampling",
  default: "4:2:0",
} as const satisfies JSONSchema7;

export const jpegExportOptionsSchema = {
  type: "object",
  description: "Options for exporting a JPEG image",
  required: [],
  properties: {
    quality: imageQualitySchema,
    progressive: progressiveScanSchema,
    chromaSubsampling: chromaSubsamplingSchema,
    optimiseCoding: optimiseCodingSchema,
    optimizeCoding: optimiseCodingSchema,
    mozjpeg: {
      type: "boolean",
      description:
        "Use the MozJPEG defaults, equivalent to `{trellisQuantisation: true, overshootDeringing: true, optimiseScans: true, quantisationTable: 3}`",
      default: false,
    },
    trellisQuantisation: {
      type: "boolean",
      description: "Apply trellis quantisation.",
      default: false,
    },
    overshootDeringing: {
      type: "boolean",
      description: "Apply overshoot deringing.",
      default: false,
    },
    optimiseScans: optimiseScansSchema,
    optimizeScans: optimiseScansSchema,
    quantisationTable: quantisationTableSchema,
    quantizationTable: quantisationTableSchema,
  },
} as const satisfies JSONSchema7;

export type JpegExportOptions = FromSchema<typeof jpegExportOptionsSchema>;

export const validateJpegExportOptions = laxValidator.compile(
  jpegExportOptionsSchema
);
export const cleanJpegExportOptions = cleanValidator.compile(
  jpegExportOptionsSchema
);

export const pngExportOptionsSchema = {
  type: "object",
  description: "Options for exporting a PNG image",
  required: [],
  properties: {
    progressive: progressiveScanSchema,
    compressionLevel: {
      type: "integer",
      description:
        "zlib Compression level, 0 (fastest, largest) - 9 (slowest, smallest)",
      minimum: 0,
      maximum: 9,
      default: 6,
    },
    adaptiveFiltering: {
      type: "boolean",
      description: "Use adaptive row filtering",
      default: false,
    },
    palette: {
      type: "boolean",
      description:
        "Quantise to a palette-based image with alpha transparency support",
      default: true,
    },
    quality: imageQualitySchema,
    effort: {
      type: "integer",
      description:
        "CPU effort level, 1 (fastest) - 10 (slowest), sets palette to true",
      minimum: 1,
      maximum: 10,
      default: 7,
    },
    colors: numColorsSchema,
    colours: numColorsSchema,
    dither: {
      type: "number",
      description: "Dithering level, 0 (none) - 1 (full). Sets palette to true",
      minimum: 0.0,
      maximum: 1.0,
      default: 1.0,
    },
  },
} as const satisfies JSONSchema7;

export type PngExportOptions = FromSchema<typeof pngExportOptionsSchema>;

export const validatePngExportOptions = laxValidator.compile(
  pngExportOptionsSchema
);
export const cleanPngExportOptions = cleanValidator.compile(
  pngExportOptionsSchema
);

export const losslessCompressionSchema = {
  type: "boolean",
  description: "Use lossless compression",
  default: false,
} as const satisfies JSONSchema7;

export const webpExportOptionsSchema = {
  type: "object",
  description: "Options for exporting a WebP image",
  required: [],
  properties: {
    quality: imageQualitySchema,
    alphaQuality: {
      ...imageQualitySchema,
      description: "Quality of alpha layer",
    },
    lossless: losslessCompressionSchema,
    nearLossless: {
      type: "boolean",
      description: "Use near-lossless compression",
      default: false,
    },
    smartSubsample: {
      type: "boolean",
      description: "use high quality chroma subsampling",
      default: false,
    },
    effort: {
      type: "integer",
      description: "CPU effort level, 0 (fastest) - 6 (slowest)",
      minimum: 0,
      maximum: 6,
      default: 4,
    },
  },
} as const satisfies JSONSchema7;

export type WebpExportOptions = FromSchema<typeof webpExportOptionsSchema>;

export const validateWebpExportOptions = laxValidator.compile(
  webpExportOptionsSchema
);
export const cleanWebpExportOptions = cleanValidator.compile(
  webpExportOptionsSchema
);

export const tiffExportOptionsSchema = {
  type: "object",
  description: "Options for exporting a TIFF image",
  required: [],
  properties: {
    quality: imageQualitySchema,
    compression: {
      type: "string",
      description: "Compression type",
      enum: [
        "none",
        "jpeg",
        "lzw",
        "deflate",
        "packbits",
        "ccittfax4",
        "webp",
        "zstd",
        "jp2k",
      ],
      default: "jpeg",
    },
    predictor: {
      type: "string",
      description: "Compression predictor type",
      enum: ["none", "horizontal", "float"],
    },
    pyramid: {
      type: "boolean",
      description: "write an image pyramid",
      default: false,
    },
    tile: {
      type: "boolean",
      description: "write a tiled tiff",
      default: false,
    },
    tileWidth: {
      type: "integer",
      description: "tile width",
      default: 256,
    },
    tileHeight: {
      type: "integer",
      description: "tile height",
      default: 256,
    },
    xres: {
      type: "number",
      description: "horizontal resolution in pixels per mm",
      default: 1.0,
    },
    yres: {
      type: "number",
      description: "vertical resolution in pixels per mm",
      default: 1.0,
    },
    resolutionUnit: {
      type: "string",
      description: "resolution unit",
      enum: ["inch", "cm"],
      default: "inch",
    },
    bitDepth: {
      type: "integer",
      description: "bit depth",
      default: 8,
      enum: [1, 2, 4, 8],
    },
  },
} as const satisfies JSONSchema7;

export type TiffExportOptions = FromSchema<typeof tiffExportOptionsSchema>;

export const validateTiffExportOptions = laxValidator.compile(
  tiffExportOptionsSchema
);
export const cleanTiffExportOptions = cleanValidator.compile(
  tiffExportOptionsSchema
);

export const avifExportOptionsSchema = {
  type: "object",
  description: "Options for exporting an AVIF image",
  required: [],
  properties: {
    quality: imageQualitySchema,
    lossless: losslessCompressionSchema,
    effort: {
      type: "integer",
      description: "CPU effort level, 0 (fastest) - 9 (slowest)",
      minimum: 0,
      maximum: 9,
      default: 4,
    },
    chromaSubsampling: chromaSubsamplingSchema,
  },
} as const satisfies JSONSchema7;

export type AvifExportOptions = FromSchema<typeof avifExportOptionsSchema>;

export const validateAvifExportOptions = laxValidator.compile(
  avifExportOptionsSchema
);
export const cleanAvifExportOptions = cleanValidator.compile(
  avifExportOptionsSchema
);

// export const rawExportOptionsSchema = {
//   type: "object",
//   description: "Options for exporting a RAW image",
//   required: [],
//   properties: {
//     depth: {
//       type: "string",
//       description: "Bit depth",
//       enum: [
//         "char",
//         "uchar",
//         "short",
//         "ushort",
//         "int",
//         "uint",
//         "float",
//         "complex",
//         "double",
//         "dpcomplex",
//       ],
//     },
//   },
// } as const satisfies JSONSchema7;

// export type RawExportOptions = FromSchema<typeof rawExportOptionsSchema>;

// export const validateRawExportOptions = laxValidator.compile(
//   rawExportOptionsSchema
// );

// export const cleanRawExportOptions = removeExtra.compile(
//   rawExportOptionsSchema
// );

export const utilsByFormat = {
  jpeg: {
    exportOptionsSchema: jpegExportOptionsSchema,
    validate: validateJpegExportOptions,
    clean: cleanJpegExportOptions,
  },
  png: {
    exportOptionsSchema: pngExportOptionsSchema,
    validate: validatePngExportOptions,
    clean: cleanPngExportOptions,
  },
  webp: {
    exportOptionsSchema: webpExportOptionsSchema,
    validate: validateWebpExportOptions,
    clean: cleanWebpExportOptions,
  },
  tiff: {
    exportOptionsSchema: tiffExportOptionsSchema,
    validate: validateTiffExportOptions,
    clean: cleanTiffExportOptions,
  },
  avif: {
    exportOptionsSchema: avifExportOptionsSchema,
    validate: validateAvifExportOptions,
    clean: cleanAvifExportOptions,
  },
  // raw: {
  //   exportOptionsSchema: rawExportOptionsSchema,
  //   validate: validateRawExportOptions,
  //   clean: cleanRawExportOptions,
  // },
} as const;

export const imageQueryParamsSchema = {
  type: "object",
  description: "Query parameters for fetching an image",
  required: [],
  properties: {
    ...imageResizeOptionsSchema.properties,
    ...urlShortenOptionsSchema.properties,
    pos: {
      ...imageResizeOptionsSchema.properties.pos,
      enum: allPosOptions,
    },
    ...jpegExportOptionsSchema.properties,
    ...pngExportOptionsSchema.properties,
    ...webpExportOptionsSchema.properties,
    ...tiffExportOptionsSchema.properties,
    ...avifExportOptionsSchema.properties,
    // ...rawExportOptionsSchema.properties,
  },
} as const satisfies JSONSchema7;

export type ImageQueryParams = FromSchema<typeof imageQueryParamsSchema>;

export const urlCacheQueryParamsSchema = {
  allOf: [
    imageQueryParamsSchema,
    {
      type: "object",
      description: "Query parameters for fetching an web image by url",
      required: ["url"],
      properties: {
        url: {
          type: "string",
          description: "URL of the image to fetch",
          format: "uri",
        },
        fmt: {
          type: "string",
          description: "Format of the image to fetch",
          enum: outputImageFormats,
        },
      },
    },
  ],
} as const satisfies JSONSchema7;

export type UrlCacheQueryParams = FromSchema<typeof urlCacheQueryParamsSchema>;

export const imageParamsSchema = {
  allOf: [
    imageResizeOptionsSchema,
    jpegExportOptionsSchema,
    pngExportOptionsSchema,
    webpExportOptionsSchema,
    tiffExportOptionsSchema,
    avifExportOptionsSchema,
  ],
} as const satisfies JSONSchema7;

export type ImageParams = FromSchema<typeof imageParamsSchema>;

export const coerceImageParams = coerceValidator.compile(imageParamsSchema);
