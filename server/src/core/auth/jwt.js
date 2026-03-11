import jwt from "jsonwebtoken";
import { config } from "../../config.js";

export function signToken(payload) {
  return jwt.sign(payload, config.accessTokenSecret, {
    expiresIn: `${config.authTokenTtlMin}m`
  });
}

export function verifyToken(token) {
  return jwt.verify(token, config.accessTokenSecret);
}
