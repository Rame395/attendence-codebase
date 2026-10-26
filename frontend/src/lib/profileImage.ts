// profile image url helper - backend /uploads path lai full URL banauxa
export interface IProfileImage {
  url: string;
  publicId?: string | null;
}

export function getProfileImageUrl(url?: string | IProfileImage | null): string | null {
  const raw = typeof url === "string" ? url : url?.url;
  if (!raw) return null;
  if (raw.startsWith("http") || raw.startsWith("blob:") || raw.startsWith("data:")) return raw;
  const base = (import.meta.env.VITE_APP_BASE_URL as string | undefined) || "";
  // base ma trailing slash cha bhane hataune
  const cleanBase = base.replace(/\/$/, "");
  return `${cleanBase}${raw.startsWith("/") ? raw : `/${raw}`}`;
}
