import mongoose from "mongoose";
import { ImageSchema } from "./schema/CommonSchema.js";

// company record - central (system) db ma matra, operational data aafnai db (dbName) ma
const CompanySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    // company ko database naam (Atlas cluster vitra unique)
    dbName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    // company logo/photo
    logo: {
      type: ImageSchema,
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

const CompanyModel = mongoose.model("Company", CompanySchema);

export default CompanyModel;
