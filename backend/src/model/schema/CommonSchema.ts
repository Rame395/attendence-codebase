import mongoose from "mongoose";

// image schema - upload gareko image ko details store garxa
export const ImageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: false,
      default: null,
    },
  },
  {
    _id: false,
  },
);

// location schema - GPS location ko details store garxa
export const LocationSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    accuracy: {
      type: Number,
      required: true,
    },
  },
  {
    _id: false,
  },
);
