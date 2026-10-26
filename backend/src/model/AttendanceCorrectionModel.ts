import mongoose from "mongoose";
import { tenantProxy } from "../config/tenantStore.js";

const AttendanceCorrectionSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    attendance: {
      type: mongoose.Types.ObjectId,
      ref: "Attendance",
      default: null,
    },

    date: {
      type: Date,
      required: true,
    },

    requestedCheckIn: {
      type: Date,
      default: null,
    },

    requestedCheckOut: {
      type: Date,
      default: null,
    },

    reason: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    reviewedBy: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    reviewReason: {
      type: String,
      default: null,
    },

    createdBy: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const AttendanceCorrectionModel = mongoose.model(
  "AttendanceCorrection",
  AttendanceCorrectionSchema,
);

// tenant-aware export - request ko company database auto-resolve huncha
export default tenantProxy("AttendanceCorrection", AttendanceCorrectionModel);