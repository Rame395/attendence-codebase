import { AsyncLocalStorage } from "node:async_hooks";

// tenant context store - AsyncLocalStorage, circular import bata jogina resolver tenant.ts le set garxa

interface TenantContext {
  dbName: string | null;
}

const als = new AsyncLocalStorage<TenantContext>();

// model resolver - tenant.ts le server boot ma register garxa
let modelResolver: ((modelName: string) => any) | null = null;

export function setModelResolver(resolver: (modelName: string) => any) {
  modelResolver = resolver;
}

// current request kun database ma chha (chaina bhane null = central default)
export function currentDbName(): string | null {
  try {
    return als.getStore()?.dbName ?? null;
  } catch {
    return null;
  }
}

// diiyeko database context ma function chalaune (arko company ma kaam garda)
export function runWithTenant<T>(dbName: string | null, fn: () => T): T {
  return als.run({ dbName }, fn);
}

// ALS context vitra next() chalaune express middleware helper
export function runTenantMiddleware(
  dbName: string | null,
  next: () => void,
) {
  return als.run({ dbName }, next);
}

// proxy -> real (central fallback) mapping - registry ma proxy nadine (reflection recursion bata jalan)
const fallbackOf = new WeakMap<object, any>();

export function baseModel(proxied: any): any {
  if (!proxied) return proxied;
  return fallbackOf.get(proxied) ?? proxied;
}

// tenant-aware model proxy
export function tenantProxy<T extends object>(
  modelName: string,
  fallbackModel: T,
): T {
  const dummy = function () {};
  const proxy = new Proxy(dummy, {
    get(_target, prop) {
      const current = resolveModel(modelName, fallbackModel);
      const value = Reflect.get(current as object, prop);
      return typeof value === "function" ? value.bind(current) : value;
    },
    has(_target, prop) {
      return Reflect.has(resolveModel(modelName, fallbackModel) as object, prop);
    },
    getPrototypeOf() {
      const current = resolveModel(modelName, fallbackModel) as any;
      return current?.prototype ?? Object.getPrototypeOf(fallbackModel);
    },
    construct(_target, args) {
      const current = resolveModel(modelName, fallbackModel) as any;
      return Reflect.construct(current, args);
    },
  }) as unknown as T;
  fallbackOf.set(proxy, fallbackModel);
  return proxy;
}

function resolveModel(modelName: string, fallbackModel: any) {
  try {
    if (modelResolver) {
      const resolved = modelResolver(modelName);
      if (resolved) return resolved;
    }
  } catch {
    // resolver fail bhaye fallback - request fail hunu hudaina
  }
  return fallbackModel;
}
