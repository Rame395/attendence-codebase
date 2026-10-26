import mongoose from "mongoose";
import { tenantProxy } from "../config/tenantStore.js";

const AuditLogSchema = new mongoose.Schema(
  {
    performedBy: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },

    // performer ko display name snapshot - user delete pachi pani "By UserName" dekhincha
    performedByName: {
      type: String,
      default: null,
      trim: true,
    },

    action: {
      type: String,
      required: true,
    },

    module: {
      type: String,
      required: true,
    },

    targetId: {
      type: mongoose.Types.ObjectId,
      required: false,
      default: null,
    },

    employee: {
      type: mongoose.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    oldData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    newData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    reason: {
      type: String,
      default: null,
    },

    ipAddress: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const AuditLogModel = mongoose.model(
  "AuditLog",
  AuditLogSchema,
);

// tenant-aware export - request ko company database auto-resolve huncha
export default tenantProxy("AuditLog", AuditLogModel);
