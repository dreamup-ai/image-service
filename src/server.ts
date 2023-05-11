import cookie from "@fastify/cookie";
import { JsonSchemaToTsProvider } from "@fastify/type-provider-json-schema-to-ts";
import Fastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import config from "./config";
import imageRoutes from "./routes/image";

export const build = async (opts: FastifyServerOptions) => {
  const server = Fastify(opts).withTypeProvider<JsonSchemaToTsProvider>();

  await server.register(require("@fastify/swagger"), {
    routePrefix: "/docs",
    exposeRoute: true,
    mode: "dynamic",
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "Dreamup Image API",
        description: "API for Dreamup Image Management",
        version: config.server.version,
      },
      // webhooks: {
      //   "image.created": {
      //     description: "image created",
      //     post: {
      //       requestBody: {
      //         description: "image created",
      //         content: {
      //           "application/json": {
      //             schema: imageSchema,
      //           },
      //         },
      //       },
      //       responses: {
      //         "200": {
      //           description: "Return a 200 status to acknowledge the webhook",
      //         },
      //       },
      //     },
      //   },
      //   "image.updated": {
      //     description: "image updated",
      //     post: {
      //       requestBody: {
      //         description: "Updated image",
      //         content: {
      //           "application/json": {
      //             schema: imageSchema,
      //           },
      //         },
      //       },
      //       responses: {
      //         "200": {
      //           description: "Return a 200 status to acknowledge the webhook",
      //         },
      //       },
      //     },
      //   },
      //   "image.deleted": {
      //     description: "image deleted",
      //     post: {
      //       requestBody: {
      //         description: "Deleted image",
      //         content: {
      //           "application/json": {
      //             schema: imageSchema,
      //           },
      //         },
      //       },
      //       responses: {
      //         "200": {
      //           description: "Return a 200 status to acknowledge the webhook",
      //         },
      //       },
      //     },
      //   },
      // },

      servers: [{ url: config.server.publicUrl }],
    },
    hideUntagged: false,
  });
  await server.register(require("@fastify/swagger-ui"), {
    routePrefix: "/docs",
    exposeRoute: true,
  });

  server.get(
    "/hc",
    {
      schema: {
        response: {
          200: {
            type: "string",
          },
        },
      },
    },
    async () => {
      return "OK";
    }
  );
  server.setErrorHandler((error, request, reply) => {
    const { message, statusCode, validation, validationContext } = error;
    if (validation) {
      reply.status(400).send({
        error: message,
      });
    } else {
      // This is the only place we do something different from prod and dev
      if (process.env.NODE_ENV === "production") {
        server.log.error(error);
      } else {
        // Stack traces are easy to read this way than with single-line json objects
        console.error(error);
      }
      reply.status(statusCode || 500).send({
        error: message,
      });
    }
  });

  server.register(cookie);
  server.register(imageRoutes);

  await server.ready();
  return server;
};

export const start = async (server: FastifyInstance) => {
  try {
    await server.listen({
      port: config.server.port,
      host: config.server.host,
    });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};
