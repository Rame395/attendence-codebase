import mongoose from "mongoose";
import type { Request, Response, NextFunction } from "express";

import { MongoConfig } from "./appConfig.js";
import {
  baseModel,
  currentDbName,
  runTenantMiddleware,
  runWithTenant as runWithTenantStore,
  setModelResolver,
} from "./tenantStore.js";

import CompanyModelDirect from "../model/CompanyModel.js";
import UserModel from "../model/UserModel.js";
import EmployeeModel from "../model/EmployeeModel.js";
import DepartmentModel from "../model/DepartmentModel.js";
import DesignationModel from "../model/DesignationModel.js";
import BranchModel from "../model/BranchModel.js";
import AttendanceModel from "../model/AttendanceModel.js";
import AttendanceCorrectionModel from "../model/AttendanceCorrectionModel.js";
import LeaveRequestModel from "../model/LeaveRequestModel.js";
import HolidayModel from "../model/HolidayModel.js";
import EventModel from "../model/EventModel.js";
import NotificationModel from "../model/NotificationModel.js";
import AuditLogModel from "../model/AuditLogModel.js";
import CompanySettingModel from "../model/CompanySettingModel.js";
import { getVerifiedAuth } from "../utils/requestAuth.js";

// multi-company db routing - proxy bata auto-resolve

// central database naam (.env MONGO_NAME nai)
export const CENTRAL_DB_NAME = MongoConfig.name as string;

// tenant database ma hune models - schemas liyera company connection ma register garinxa
const TENANT_MODEL_DEFS = [
  UserModel,
  EmployeeModel,
  DepartmentModel,
  DesignationModel,
  BranchModel,
  AttendanceModel,
  AttendanceCorrectionModel,
  LeaveRequestModel,
  HolidayModel,
  EventModel,
  NotificationModel,
  AuditLogModel,
  CompanySettingModel,
] as unknown as Array<{ modelName: string; schema: mongoose.Schema }>;

const centralModels: Record<string, any> = {};
const centralSchemas: Record<string, mongoose.Schema> = {};
// canonical (non-alias) model names - tenant connection ma register (MissingSchemaError naa'os)
const tenantModelNames: string[] = [];
for (const m of TENANT_MODEL_DEFS) {
  // baseModel (real central model) matra store garne - proxy kahilyai hoina
  const base: any = baseModel(m as any);
  centralModels[base.modelName] = base;
  centralSchemas[base.modelName] = base.schema;
  tenantModelNames.push(base.modelName);
}
// alias pani rakheko (UserModel jasto naam le pani milos - mistake-proof)
for (const key of Object.keys(centralModels)) {
  centralModels[`${key}Model`] = centralModels[key];
  centralSchemas[`${key}Model`] = centralSchemas[key];
}

// known company databases - JWT dbName valid chha ki sync check (stale db le auto-create nadine)
const knownTenantDbs = new Set<string>();

export async function refreshTenantCache(): Promise<void> {
  try {
    // Company central-only model - direct import
    const list: any[] = await CompanyModelDirect.find({})
      .select("dbName")
      .lean();
    knownTenantDbs.clear();
    for (const c of list) {
      if (c.dbName && c.dbName !== CENTRAL_DB_NAME) {
        knownTenantDbs.add(c.dbName);
      }
    }
  } catch (error) {
    console.error(
      "[tenant] cache refresh failed:",
      (error as any)?.message || error,
    );
  }
}

export function noteTenantAdded(dbName: string) {
  if (dbName && dbName !== CENTRAL_DB_NAME) knownTenantDbs.add(dbName);
}

export function noteTenantRemoved(dbName: string) {
  knownTenantDbs.delete(dbName);
}

export function isKnownTenant(dbName?: string | null): boolean {
  return !!dbName && (dbName === CENTRAL_DB_NAME || knownTenantDbs.has(dbName));
}

const connectionCache = new Map<string, mongoose.Connection>();

// company database ko lagi connection (cache garine, pool share huncha)
export function getTenantConnection(dbName: string): mongoose.Connection {
  const cached = connectionCache.get(dbName);
  if (cached) return cached;

  const conn = mongoose.createConnection(MongoConfig.url as string, {
    dbName,
    autoCreate: true,
    autoIndex: true,
  });
  conn.on("error", (error) => {
    console.error(`[tenant:${dbName}] connection error:`, error?.message || error);
  });
  connectionCache.set(dbName, conn);
  return conn;
}

// database + model naam anusar EUTA model - lazy register garine (bulk hoina)
export function getTenantModel(
  dbName: string | null | undefined,
  modelName: string,
): any {
  if (!dbName || dbName === CENTRAL_DB_NAME) {
    return centralModels[modelName] ?? null;
  }
  const schema = centralSchemas[modelName];
  if (!schema) throw new Error(`Unknown model: ${modelName}`);
  const conn = getTenantConnection(dbName);
  if (!conn.models[modelName]) {
    // pailo model huda BAKI tenant schemas pani register garne (populate fail naa'os)
    for (const name of tenantModelNames) {
      if (!conn.models[name]) conn.model(name, centralSchemas[name]);
    }
  }
  return conn.models[modelName] ?? null;
}

// model proxy resolver register - server boot ma ek choti (import time mai)
setModelResolver((modelName: string) => {
  return getTenantModel(currentDbName(), modelName);
});

// diiyeko database context ma function chalaune (owner le arko company ma kaam garda)
export function runWithTenant<T>(dbName: string | null | undefined, fn: () => T): T {
  return runWithTenantStore(dbName ?? null, fn);
}

// company delete pachi connection hataune (purge db ma feri write naa'os)
export async function releaseTenantConnection(dbName: string): Promise<void> {
  noteTenantRemoved(dbName);
  const conn = connectionCache.get(dbName);
  if (conn) {
    connectionCache.delete(dbName);
    try {
      await conn.close();
    } catch {
      // already closed - ignore
    }
  }
}

// har request ko suru ma company db resolve garne (JWT dbName bata, central/known matra)
export function tenantContext() {
  return (req: Request, _res: Response, next: NextFunction) => {
    let dbName: string | null = null;
    const { decoded } = getVerifiedAuth(req);
    const claimed = decoded?.companyDb;
    if (claimed && isKnownTenant(claimed)) dbName = claimed;
    // invalid/missing token - central default, checkLogin le 401 handle garxa
    runTenantMiddleware(dbName, next);
  };
}
