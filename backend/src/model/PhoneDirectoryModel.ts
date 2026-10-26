import mongoose from "mongoose";

// central phone directory - phone global uniqueness ko arbiter (email directory jastai)
const PhoneDirectorySchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    dbName: {
      type: String,
      required: true,
      trim: true,
    },

    userId: {
      type: mongoose.Types.ObjectId,
      default: null,
    },

    employeeId: {
      type: mongoose.Types.ObjectId,
      default: null,
    },

    company: {
      type: mongoose.Types.ObjectId,
      ref: "Company",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const PhoneDirectoryModel = mongoose.model("PhoneDirectory", PhoneDirectorySchema);

export default PhoneDirectoryModel;