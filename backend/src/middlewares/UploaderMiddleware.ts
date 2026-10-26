import type { Request } from "express";
import multer from "multer";

// multer middleware - memoryStorage, service layer fileStorage helper bata save huncha
const uploader = (dir:string ='/') => {
  void dir;

  // file validation config
  const fileFilter = (req: Request, file: Express.Multer.File, cb: (obj: Error | null, arg?: boolean) =>void) => {
    const ext= file.originalname.split(".").pop() as string;
    // JPG
    const allowedExts = ['jpg','jpeg','png','svg','bmp','webp','pdf']
    if(allowedExts.includes(ext.toLowerCase())) {
      cb(null, true)
    } else {
      cb(new Error("File format not supported"))
    }
  }

  return multer({
    storage: multer.memoryStorage(),
    fileFilter: fileFilter,
    limits: {
      fileSize: 3 * 1024 * 1024
    }
  });
}

export default uploader;
