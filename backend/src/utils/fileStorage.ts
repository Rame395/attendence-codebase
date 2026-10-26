import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

// file storage helper - local disk, /uploads serve garchha

export type UploadFolder = "profiles" | "events" | "leaves" | "companies";

export interface StoredFile {
  url: string;
  publicId: string;
  // purano cloud data sanga compatibility ko lagi rakheko - ahile sadhai local
  storage: "local";
}

// multer file lai public/uploads/<folder>/ ma save garne (purano naming scheme)
export async function saveUploadedFile(
  file: Express.Multer.File,
  folder: UploadFolder,
): Promise<StoredFile> {
  if (!file?.buffer || file.buffer.length === 0) {
    throw { code: 422, message: "No file uploaded" };
  }

  const ext = (file.originalname.split(".").pop() || "bin").toLowerCase();
  const fileName = `Uploads-${folder}-${Date.now()}.${ext}`;
  const dirPath = resolve(process.cwd(), "public", "uploads", folder);
  await mkdir(dirPath, { recursive: true });
  await writeFile(join(dirPath, fileName), file.buffer);

  return {
    url: `/uploads/${folder}/${fileName}`,
    publicId: fileName,
    storage: "local",
  };
}

// stored local file hataune - legacy cloud URL bhaye safely ignore
export async function removeStoredFile(
  image:
    | { url?: string | null; publicId?: string | null }
    | string
    | null
    | undefined,
): Promise<void> {
  if (!image) return;

  const url = typeof image === "string" ? image : (image.url ?? null);
  if (!url || !url.startsWith("/uploads/")) return;

  try {
    await unlink(resolve("public", url.replace(/^\//, "")));
  } catch {
    // file already missing - ignore garne
  }
}
