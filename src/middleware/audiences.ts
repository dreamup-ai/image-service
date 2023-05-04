import config from "../config";
import { sessionValidator } from "./validate-session";
import { makeSourceValidator } from "./validate-source";

export const dreamupInternal = makeSourceValidator(
  config.webhooks.publicKey,
  config.webhooks.signatureHeader
);

export { sessionValidator as dreamupUserSession };

export const either = (a: any, b: any) => async (request: any, reply: any) => {
  try {
    await a(request, reply);
  } catch (e: any) {
    if (e.continue) {
      await b(request, reply);
    } else if (e.redirect) {
      reply.code(e.code).redirect(e.redirect);
    } else {
      reply.code(e.code).send({ error: e.error });
    }
  }
};
