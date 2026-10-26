// Central login directory backfill - tenant users scan garera sync, conflict report matra (Usage: pnpm directory:backfill)
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { MongoConfig } from "../config/appConfig.js";
import CompanyModel from "../model/CompanyModel.js";
import UserDirectoryModel from "../model/UserDirectoryModel.js";
import UserDirectoryService from "../services/UserDirectoryService.js";
import { getTenantModel } from "../config/tenant.js";

async function main() {
  const url = MongoConfig.url as string;
  const dbName = MongoConfig.name as string;
  if (!url || !dbName) {
    console.error("MONGO_URI / MONGO_NAME missing in .env");
    process.exit(1);
  }
  await mongoose.connect(url, { dbName, autoCreate: false, autoIndex: false });
  console.log(`Connected to central DB: ${dbName}`);

  await UserDirectoryModel.init();

  const companies: any[] = await CompanyModel.find({}).select("name dbName").lean();
  console.log(`Companies: ${companies.length}`);

  let scanned = 0;
  let added = 0;
  const skipped: Array<{ email: string; keptDb: string; skippedDb: string }> = [];

  for (const c of companies) {
    let users: any[] = [];
    try {
      const U = getTenantModel(c.dbName, "User");
      users = await U.find({}).select("_id email role company").lean();
    } catch (error: any) {
      console.error(`  ! scan ${c.dbName} failed:`, error?.message || error);
      continue;
    }
    for (const u of users) {
      if (!u?.email) continue;
      scanned += 1;
      const email = String(u.email).toLowerCase().trim();
      try {
        const existing: any = await UserDirectoryModel.findOne({ email }).lean();
        if (existing) {
          if (existing.dbName !== c.dbName || String(existing.userId) !== String(u._id)) {
            skipped.push({ email, keptDb: existing.dbName, skippedDb: c.dbName });
          }
          continue;
        }
        await UserDirectoryModel.create({
          email,
          dbName: c.dbName,
          userId: u._id,
          company: (u.company as any) || null,
          role: (u.role as any) || null,
        });
        added += 1;
      } catch (error: any) {
        if (UserDirectoryService.isDuplicateKeyError(error)) {
          const existing: any = await UserDirectoryModel.findOne({ email }).lean().catch(() => null);
          skipped.push({ email, keptDb: existing?.dbName || "?", skippedDb: c.dbName });
        } else {
          console.error(`  ! upsert ${email} failed:`, error?.message || error);
        }
      }
    }
    console.log(`  ${c.name} (${c.dbName}): ${users.length} users scanned`);
  }

  console.log(`\nDone. scanned=${scanned} added=${added} conflicts=${skipped.length}`);
  if (skipped.length) {
    console.log("CONFLICTS (same email in 2 DBs - kept first, merge manually):");
    for (const s of skipped) {
      console.log(`  ${s.email}: kept ${s.keptDb}, skipped ${s.skippedDb}`);
    }
  }
  await mongoose.disconnect();
  process.exit(skipped.length ? 2 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
