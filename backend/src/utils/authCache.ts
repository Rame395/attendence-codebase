// TTL caches for auth hot-path lookups

const DEFAULT_COMPANY_TTL_MS = 60_000;
const DEFAULT_USER_PERM_TTL_MS = 30_000;
// Negative (not-found) entry lai chhoto - stale token hammer + delete pachi lamo block nahos
const DEFAULT_NEGATIVE_TTL_MS = 15_000;
const DEFAULT_MAX_ENTRIES = 5_000;

function envMs(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function companyTtlMs(): number {
  return envMs("AUTH_COMPANY_CACHE_TTL_MS", DEFAULT_COMPANY_TTL_MS);
}

function userPermTtlMs(): number {
  return envMs("AUTH_PERM_CACHE_TTL_MS", DEFAULT_USER_PERM_TTL_MS);
}

function sessionTtlMs(): number {
  return envMs("AUTH_SESSION_CACHE_TTL_MS", DEFAULT_USER_PERM_TTL_MS);
}

function negativeTtlMs(): number {
  return envMs("AUTH_NEGATIVE_CACHE_TTL_MS", DEFAULT_NEGATIVE_TTL_MS);
}

function maxEntries(): number {
  return envMs("AUTH_CACHE_MAX_ENTRIES", DEFAULT_MAX_ENTRIES);
}

interface Entry<T> {
  value: T;
  expiresAt: number;
}

class TtlCache<T> {
  private map = new Map<string, Entry<T>>();

  get(key: string): T | null {
    const e = this.map.get(key);
    if (!e) return null;
    if (Date.now() > e.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return e.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    // unbounded growth rokna - sabaibhanda purano (first-inserted) hataune
    if (!this.map.has(key) && this.map.size >= maxEntries()) {
      const oldest = this.map.keys().next().value as string | undefined;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}

export interface CompanyStatus {
  exists: boolean;
  status: string | null;
}

export interface UserPermStatus {
  exists: boolean;
  status: string | null;
  permissions: string[];
}

// session revocation check ko lagi - userId le key (cross-tenant ObjectId collision bhaye pani
// companyDb verify garera miss handle garincha, entry overwrite huncha)
export interface UserSessionStatus {
  exists: boolean;
  companyDb: string | null;
  status: string | null;
  tokenVersion: number;
}

const companyByIdCache = new TtlCache<CompanyStatus>();
const companyByDbNameCache = new TtlCache<CompanyStatus>();
const userPermCache = new TtlCache<UserPermStatus>();
const userSessionCache = new TtlCache<UserSessionStatus>();

function companyKeyStage(exists: boolean): number {
  return exists ? companyTtlMs() : negativeTtlMs();
}

export async function getCachedCompanyStatusById(
  companyId: string,
  fetchFn: () => Promise<{ status?: string | null } | null>,
): Promise<CompanyStatus> {
  const hit = companyByIdCache.get(companyId);
  if (hit) return hit;

  const doc = await fetchFn();
  const out: CompanyStatus = doc
    ? { exists: true, status: doc.status ?? null }
    : { exists: false, status: null };
  companyByIdCache.set(companyId, out, companyKeyStage(out.exists));
  return out;
}

export async function getCachedCompanyStatusByDbName(
  dbName: string,
  fetchFn: () => Promise<{ status?: string | null } | null>,
): Promise<CompanyStatus> {
  const hit = companyByDbNameCache.get(dbName);
  if (hit) return hit;

  const doc = await fetchFn();
  const out: CompanyStatus = doc
    ? { exists: true, status: doc.status ?? null }
    : { exists: false, status: null };
  companyByDbNameCache.set(dbName, out, companyKeyStage(out.exists));
  return out;
}

export async function getCachedUserPerms(
  companyDb: string,
  userId: string,
  fetchFn: () => Promise<{ status?: string | null; permissions?: string[] } | null>,
): Promise<UserPermStatus> {
  const key = `${companyDb}:${userId}`;
  const hit = userPermCache.get(key);
  if (hit) return hit;

  const doc = await fetchFn();
  const out: UserPermStatus = doc
    ? {
        exists: true,
        status: (doc.status as string) ?? null,
        permissions: Array.isArray(doc.permissions) ? (doc.permissions as string[]) : [],
      }
    : { exists: false, status: null, permissions: [] };
  userPermCache.set(key, out, out.exists ? userPermTtlMs() : negativeTtlMs());
  return out;
}

// Write path bata call garne - deactivation/permission change turuntai lagu hos
export function invalidateCompanyCache(companyId?: string | null, dbName?: string | null): void {
  if (companyId) companyByIdCache.delete(companyId);
  if (dbName) companyByDbNameCache.delete(dbName);
}

export function invalidateUserPerms(companyDb?: string | null, userId?: string | null): void {
  if (companyDb && userId) userPermCache.delete(`${companyDb}:${userId}`);
}

// session write (password/email/status/delete) pachi call garne - purano token turuntai dead hos
// key userId matra ho (write path ma dbName chainna) - hit ma companyDb verify garincha,
// mismatch bhaye miss mane overwrite (cross-tenant ObjectId collision safe)
export async function getCachedUserSession(
  userId: string,
  companyDb: string | null,
  fetchFn: () => Promise<{ status?: string | null; tokenVersion?: number | null } | null>,
): Promise<UserSessionStatus> {
  const hit = userSessionCache.get(userId);
  if (hit && hit.companyDb === companyDb) return hit;

  const doc = await fetchFn();
  const out: UserSessionStatus = doc
    ? {
        exists: true,
        companyDb,
        status: (doc.status as string) ?? null,
        tokenVersion: Number(doc.tokenVersion ?? 0),
      }
    : { exists: false, companyDb, status: null, tokenVersion: 0 };
  userSessionCache.set(userId, out, out.exists ? sessionTtlMs() : negativeTtlMs());
  return out;
}

export function invalidateUserSession(userId?: string | null): void {
  if (userId) userSessionCache.delete(String(userId));
}

// Test/debug ko lagi
export function clearAuthCaches(): void {
  companyByIdCache.clear();
  companyByDbNameCache.clear();
  userPermCache.clear();
  userSessionCache.clear();
}
