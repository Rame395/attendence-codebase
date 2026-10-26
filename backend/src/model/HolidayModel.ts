import mongoose from "mongoose";
import { tenantProxy } from "../config/tenantStore.js";

const HolidaySchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },

        description: {
            type: String,
            default: null,
        },

        // multi-day holiday support
        startDate: {
            type: Date,
            required: true,
        },

        endDate: {
            type: Date,
            required: true,
        },

        // kun lai apply hunchha: sabai / specific branch / specific department
        appliesTo: {
            type: String,
            enum: ["all", "branch", "department"],
            default: "all",
        },

        branches: [
            {
                type: mongoose.Types.ObjectId,
                ref: "Branch",
            },
        ],

        departments: [
            {
                type: mongoose.Types.ObjectId,
                ref: "Department",
            },
        ],

        // kun gender lai matra (e.g. women's day)
        gender: {
            type: String,
            enum: ["both", "male", "female"],
            default: "both",
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

const HolidayModel = mongoose.model(
    "Holiday",
    HolidaySchema
);

// tenant-aware export - request ko company database auto-resolve huncha
export default tenantProxy("Holiday", HolidayModel);
