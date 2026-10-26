import type { Request, Response, NextFunction } from "express";

interface CustomError extends Error {
  details?:
    | Record<string, string | Array<Record<string, string>>>
    | null
    | string;
  code?: string | number;
  keyPattern?: Record<string, any>;
}

// global error handler - sabai errors lai handle garxa
export default function ErrorHandler(error: CustomError, req: Request, res: Response, next: NextFunction) {
  let detail: any = error.details || error.stack || null;
  let code = error.code || 500;
  let message = error.message || "Internal Server Error ....";

  // mongodb duplicate key error lai handle garxa
  if (error.name === "MongoServerError") {
    code = 422;
    if (error.code === 11000) {
      detail = {} as Record<string, any>;
      const keyHints: Record<string, string> = {
        email: "This email is already in use by another account",
        phone: "This phone number is already in use",
        employeeId: "This employee ID is already in use",
        username: "This username is already in use",
        code: "This code is already in use",
        name: "This name is already in use",
        dbName: "This database name is already in use",
      };
      const messages: string[] = [];
      Object.keys(error.keyPattern as Record<string, any>).forEach((key: string) => {
        const hint = keyHints[key] || `${key} must be unique`;
        detail[key] = hint;
        messages.push(hint);
      });
      message = messages.join(" | ") || "Duplicate value submitted. Please use a different value.";
    }
  }

  // multer error codes (string) ra file filter error lai 422 banayo (500 nadiera)
  if (typeof error.code === "string") {
    code = 422;
  }
  if (/File format not supported/i.test(error.message || "")) {
    code = 422;
  }
  // invalid/non-numeric code bhaye 500 ma fallback garne (500 HTML aayeko thiyo)
  const status =
    Number.isInteger(Number(code)) && Number(code) >= 400 && Number(code) <= 599
      ? Number(code)
      : 500;

  res.status(status).json({
    error: detail,
    message: message,
    meta: null,
  });
}