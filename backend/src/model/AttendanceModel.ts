import mongoose from "mongoose";
import { tenantProxy } from "../config/tenantStore.js";

const AttendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    branch: {
      type: mongoose.Types.ObjectId,
      ref: "Branch",
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    checkIn: {
      time: Date,
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      distance: Number,
    },

    checkOut: {
      time: Date,
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      distance: Number,
    },

    status: {
      type: String,
      enum: [
        "present",
        "absent",
        "late",
        "half_day",
        "leave",
        "holiday",
        "weekend",
        "missing_checkin",
        "missing_checkout",
      ],
      default: "present",
    },

    workingMinutes: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

AttendanceSchema.index(
  { employee: 1, date: 1 },
  { unique: true }
);

const AttendanceModel = mongoose.model(
  "Attendance",
  AttendanceSchema
);

// tenant-aware export - request ko company database auto-resolve huncha
export default tenantProxy("Attendance", AttendanceModel);