import mongoose from "mongoose";

// central login directory - global email unique ko ATOMIC arbiter (cross-DB guarantee). Central-only model, tenantProxy chaina.
const UserDirectorySchema = new mongoose.Schema(
  {
    // global login key - sadhai lowercase
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // kun company database ma yo user bascha
    dbName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // tenant DB vitra ko user _id
    userId: {
      type: mongoose.Types.ObjectId,
      required: true,
    },

    // central Company registry ref (null = system owner / central)
    company: {
      type: mongoose.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },

    // display/status panel ko lagi (fresh auth check hoina)
    role: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// company delete/orphan scan ko lagi
UserDirectorySchema.index({ dbName: 1, userId: 1 });

const UserDirectoryModel = mongoose.model("UserDirectory", UserDirectorySchema);

export default UserDirectoryModel;
