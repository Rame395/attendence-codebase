import mongoose from "mongoose";
import { tenantProxy } from "../config/tenantStore.js";

const DesignationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    branch: {
      type: mongoose.Types.ObjectId,
      ref: "Branch",
      default: null,
    },
    department: {
      type: mongoose.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
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

const DesignationModel = mongoose.model(
  "Designation",
  DesignationSchema,
);

// tenant-aware export - request ko company database auto-resolve huncha
export default tenantProxy("Designation", DesignationModel);