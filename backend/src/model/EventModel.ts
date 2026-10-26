import mongoose from "mongoose";
import { tenantProxy } from "../config/tenantStore.js";
import { ImageSchema } from "./schema/CommonSchema.js";

const EventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: [
        "holiday",
        "company_event",
        "staff_training",
        "meeting",
        "other",
      ],
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    startTime: {
      type: String,
      default: null,
    },

    endTime: {
      type: String,
      default: null,
    },

    location: {
      type: String,
      default: null,
    },

    description: {
      type: String,
      default: null,
    },

    attachment: {
      type: ImageSchema,
      default: null,
    },

    branch: {
      type: mongoose.Types.ObjectId,
      ref: "Branch",
      default: null,
    },

    isForAllEmployees: {
      type: Boolean,
      default: true,
    },

    // audience targeting: "all" | "branch" | "department" | "employee" | "role"
    targetType: {
      type: String,
      enum: ["all", "branch", "department", "employee", "role"],
      default: "all",
    },

    // targetType === "department" huda: kis department ko lagi event ho
    department: {
      type: mongoose.Types.ObjectId,
      ref: "Department",
      default: null,
    },

    // targetType === "employee" huda: specific employee ko lagi ho
    employee: {
      type: mongoose.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    // targetType === "role" huda: kis role ko users (e.g. ["hr_admin", "manager"])
    roles: {
      type: [String],
      default: [],
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

const EventModel = mongoose.model("Event", EventSchema);

// tenant-aware export - request ko company database auto-resolve huncha
export default tenantProxy("Event", EventModel);
