import { FastifyBaseLogger } from "fastify";
import config from "./config";
import crypto from "node:crypto";

function sign(payload: string) {
  const signature = crypto.sign(
    "sha256",
    Buffer.from(payload),
    config.webhooks.privateKey
  );
  return signature.toString("base64");
}

export const sendWebhook = async (
  event: string,
  data: any,
  log: FastifyBaseLogger
) => {
  if (
    !config.webhooks.events[event] ||
    config.webhooks.events[event].length === 0
  ) {
    return;
  }
  try {
    const body = JSON.stringify({ event, payload: data });
    const signature = sign(body);
    const responses = await Promise.allSettled(
      config.webhooks.events[event].map((url) =>
        fetch(url, {
          method: "POST",
          body,
          headers: {
            "Content-Type": "application/json",
            [config.webhooks.signatureHeader]: signature,
          },
        })
      )
    );
    const failures = responses.filter(
      (response) => response.status == "rejected"
    ) as PromiseRejectedResult[];
    if (failures.length > 0) {
      failures.forEach((failure) => {
        log.error(
          `Webhook "${event}" failed to post to ${failure.reason.url} with status ${failure.reason.status}: ${failure.reason.statusText}`
        );
      });
    }
  } catch (e: any) {
    log.error(`Webhook "${event}" failed: ${e.message}`);
  }
};
