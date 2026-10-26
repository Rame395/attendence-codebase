import jwt from "jsonwebtoken";
import type { Request } from "express";

import { AppConfig } from "../config/appConfig.js";
import type { UserRole } from "../types/index.js";

// Single JWT verify per request, cached for reuse

export interface DecodedAuthToken {
  sub: string;
  role: UserRole;
  email: string;
  mustChangePassword?: boolean;
  companyDb?: string;
  company?: string | null;
  permissions?: string[];
  iat?: number;
  exp?: number;
}

interface VerifiedAuth {
  /** raw Authorization header (cache key - token rotate bhaye re-verify) */
  rawHeader: string;
  /** Bearer strip gareko token (null = header chaina) */
  token: string | null;
  /** verify success bhaye payload, natra null */
  decoded: DecodedAuthToken | null;
  /** verify fail bhaye error, success bhaye null */
  error: unknown | null;
}

const CACHE_KEY = "__verifiedAuth" as const;

function rawAuthHeader(req: Request): string {
  const h = req.headers["authorization"];
  if (!h) return "";
  if (Array.isArray(h)) return h[0] ?? "";
  return h;
}

export function extractBearerToken(req: Request): string | null {
  const header = rawAuthHeader(req);
  if (!header) return null;
  if (header.startsWith("Bearer ")) return header.slice("Bearer ".length).trim() || null;
  // purano behavior preserve - raw header nai token mane (Bearer prefix pani chalaucha)
  return header.trim() || null;
}

// Har request ma JWT EK choti matra verify garne - result req ma cache huncha.
export function getVerifiedAuth(req: Request): VerifiedAuth {
  const rawHeader = rawAuthHeader(req);
  const cached = (req as any)[CACHE_KEY] as VerifiedAuth | undefined;
  if (cached && cached.rawHeader === rawHeader) return cached;

  const token = extractBearerToken(req);
  if (!token) {
    const out: VerifiedAuth = { rawHeader, token: null, decoded: null, error: null };
    (req as any)[CACHE_KEY] = out;
    return out;
  }

  try {
    const decoded = jwt.verify(token, AppConfig.jwtSecret as string) as DecodedAuthToken;
    const out: VerifiedAuth = { rawHeader, token, decoded, error: null };
    (req as any)[CACHE_KEY] = out;
    return out;
  } catch (error) {
    const out: VerifiedAuth = { rawHeader, token, decoded: null, error };
    (req as any)[CACHE_KEY] = out;
    return out;
  }
}

// Test/edge case ma cache clear garna (normal flow ma chahidaina)
export function clearVerifiedAuthCache(req: Request): void {
  delete (req as any)[CACHE_KEY];
}
