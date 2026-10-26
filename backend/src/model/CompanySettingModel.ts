import mongoose from "mongoose";
import { tenantProxy } from "../config/tenantStore.js";

const CompanySettingSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },

    workingStartTime: {
      type: String,
      required: true,
      default: "10:00",
    },

    workingEndTime: {
      type: String,
      required: true,
      default: "18:00",
    },

    lateGracePeriodMinutes: {
      type: Number,
      required: true,
      default: 15,
    },

    minimumWorkingMinutes: {
        type: Number,
        required: true,
        default: 240,
    },

    leaveCountsTowardAttendance: {
        type: Boolean,
        required: true,
        default: true,
    },

    weeklyHolidays: [
      {
        type: String,
        enum: [
          "sunday",
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
        ],
      },
    ],

    // company brand color (superadmin le Settings bata chuncha) - Hex matra, default brand blue
    brandColor: {
      type: String,
      default: "#28469E",
      match: [/^#[0-9A-Fa-f]{6}$/, "Brand color must be a hex code like #28469E"],
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

const CompanySettingModel = mongoose.model(
  "CompanySetting",
  CompanySettingSchema,
);

// tenant-aware export - request ko company database auto-resolve huncha
export default tenantProxy("CompanySetting", CompanySettingModel);