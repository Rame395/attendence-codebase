import type { AuthUser } from "./index.js";

declare global {
  namespace Express {
    interface Request {
      loggedInUser?: AuthUser;
    }
  }
}

export {};
