import { FastifyReply, FastifyRequest } from "fastify";
import config from "../config";
import jwt from "jsonwebtoken";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      userId: string;
      sessionId: string;
    };
  }
}

export const sessionValidator = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  const publicKey = await config.session.publicKey();
  // Auth token can be in a cookie, or in the Authorization header as a bearer token
  const { authorization } = req.headers;

  let token: string;
  let code: number = 307;
  if (authorization) {
    // If the user is using the API, we don't want to redirect them to the login page
    code = 401;
    const [authType, authToken] = authorization?.split(" ") ?? [null, null];
    if (authType.toLowerCase() !== "bearer") {
      throw { code, error: "Invalid authorization type", continue: true };
    }
    token = authToken;
  } else {
    const { [config.session.cookieName]: cookieToken } = req.cookies;
    if (!cookieToken) {
      throw {
        code,
        redirect: `${config.session.loginUrl}?redirect=${req.url}`,
        continue: true,
      };
    }
    token = cookieToken;
  }

  // Token must be valid
  try {
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
    }) as jwt.JwtPayload;
    const { userId, sessionId } = decoded as {
      userId: string;
      sessionId: string;
    };

    // Set the user ID and session ID on the request
    req.user = { userId, sessionId };
  } catch (e: any) {
    if (code === 401) {
      throw { code, error: "Invalid authorization token", continue: false };
    }
    throw {
      code,
      redirect: `${config.session.loginUrl}?redirect=${req.url}`,
      continue: false,
    };
  }
};
