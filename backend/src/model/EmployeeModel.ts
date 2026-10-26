import mongoose from "mongoose";
import { ImageSchema } from "./schema/CommonSchema.js";
import { tenantProxy } from "../config/tenantStore.js";

const EmployeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    department: {
      type: mongoose.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    designation: {
      type: mongoose.Types.ObjectId,
      ref: "Designation",
      default: null,
    },
    branch: {
      type: mongoose.Types.ObjectId,
      ref: "Branch",
      default: null,
    },
    // reporting manager (aru employee ko ref)
    manager: {
      type: mongoose.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    // gender-targeted holiday ra report ko lagi
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: null,
    },
    joiningDate: {
      type: Date,
      default: null,
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
    // soft delete - history surakshit, report ma "Removed" highlight huncha
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
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
  },
);

const EmployeeModel = mongoose.model(
  "Employee",
  EmployeeSchema,
);

// tenant-aware export - request ko company database auto-resolve huncha
export default tenantProxy("Employee", EmployeeModel);