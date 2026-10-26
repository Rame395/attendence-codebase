import mongoose from "mongoose";
import { tenantProxy } from "../config/tenantStore.js";

const LeaveSchema =
  new mongoose.Schema(
    {
      employee: {
        type: mongoose.Types.ObjectId,
        ref: "Employee",
        required: true
      },

      leaveType: {
        type: String,
        required: true
      },

      startDate: {
        type: Date,
        required: true
      },

      endDate: {
        type: Date,
        required: true
      },

      reason: {
        type: String,
        required: true
      },

      attachment: {
        type: String,
        default: null
      },

      status: {
        type: String,
        enum: [
          "pending",
          "approved",
          "rejected"
        ],
        default: "pending"
      },

      reviewedBy: {
        type: mongoose.Types.ObjectId,
        ref: "User",
        default: null
      },

      reviewedAt: {
        type: Date,
        default: null
      }
    },
    {
      timestamps: true
    }
  );

const LeaveRequestModel = mongoose.model(
  "LeaveRequest",
  LeaveSchema
);

// tenant-aware export - request ko company database auto-resolve huncha
export default tenantProxy("LeaveRequest", LeaveRequestModel);