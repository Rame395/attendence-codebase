import express, { type Application } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";

import ErrorHandler from "./middlewares/ErrorHandlingMiddleware.js";
import mainRouter from "./router/router.js";

const app: Application = express();

const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [];

const isAllowedOrigin = (origin?: string) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  const lanDevRegex = /^http:\/\/[\w.-]+:(5173|4173)$/;
  return lanDevRegex.test(origin);
};

app.use(
  cors({
    origin: function (origin, cb) {
      if (isAllowedOrigin(origin)) {
        cb(null, true);
      } else {
        cb(new Error("Blocked by Cors Policy"));
      }
    },
    optionsSuccessStatus: 200,
  }),
);

// XSS protection - /uploads images <img> ma embed garna CORP/img-src relax gareko
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "img-src": ["'self'", "data:", "blob:", "http:", "https:"],
      },
    },
  }),
);

// Throttle - 150 requests per 60 seconds
const rateLimiter = rateLimit({
  limit: 150,
  windowMs: 60000,
});
app.use(rateLimiter);

// body parsers
app.use(
  express.json({
    limit: "3mb",
  }),
);
app.use(
  express.urlencoded({
    limit: "3mb",
  }),
);

app.use(mainRouter);

// uploaded files (event/leave attachment) serve garne
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "public", "uploads"), {
    maxAge: "7d",
  }),
);

// 404 handler
app.use((req, res, next) => {
  next({ code: 404, message: "Not Found" });
});

// error handling middleware
app.use(ErrorHandler);

export default app;
