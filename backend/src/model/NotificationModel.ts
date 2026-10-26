import mongoose from "mongoose";
import { tenantProxy } from "../config/tenantStore.js";

const NotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: [
        "check_in",
        "check_out",
        "late",
        "leave_requested",
        "leave_approved",
        "leave_rejected",
        "correction_requested",
        "correction_approved",
        "correction_rejected",
        "missing_checkout",
        "early_checkout",
        "event",
        "info_update",
      ],
      required: true,
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const NotificationModel = mongoose.model("Notification",NotificationSchema);

// tenant-aware export - request ko company database auto-resolve huncha
export default tenantProxy("Notification", NotificationModel);