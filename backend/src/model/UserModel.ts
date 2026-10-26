import mongoose from "mongoose";
import { ImageSchema } from "./schema/CommonSchema.js";
import { tenantProxy } from "../config/tenantStore.js";

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: [
        "platform_admin",
        "super_admin",
        "hr_admin",
        "manager",
        "employee",
      ],
      required: true,
      default: "employee",
    },

    employee: {
      type: mongoose.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    // kun company ko user ho (null = system owner / central)
    company: {
      type: mongoose.Types.ObjectId,
      ref: "Company",
      default: null,
    },

    // company superadmin lai diiyeko sidebar/function permissions (owner lai check hudaina)
    permissions: {
      type: [String],
      default: [],
    },

    profileImage: {
      type: ImageSchema,
      default: null,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    mustChangePassword: {
      type: Boolean,
      default: false,
    },

    // per-user calendar preference (profile ma user aafai chuncha - system level hoina)
    calendarPreference: {
      type: String,
      enum: ["bs", "ad"],
      default: "bs",
    },

    // session revocation counter - password reset / email change / delete ma +1,
    // JWT ko tv claim sanga match nagare token dead (purano login turuntai logout)
    tokenVersion: {
      type: Number,
      default: 0,
    },

    resetPasswordCode: {
      type: String,
      default: null,
    },

    resetPasswordExpires: {
      type: Date,
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
  }
);

const UserModel =
  mongoose.model("User", UserSchema);

// tenant-aware export - request ko company database auto-resolve huncha
export default tenantProxy("User", UserModel);