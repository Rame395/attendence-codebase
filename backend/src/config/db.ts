import mongoose from "mongoose";
import { MongoConfig } from "./appConfig.js";

export const connectDB = mongoose.connect(MongoConfig.url as string, {
  dbName: MongoConfig.name,
  // central db auto collection/index off - business collections yaha aaudaina
  autoCreate: false,
  autoIndex: false
}).then(() => {
  console.log("********* MONGODB Connected Successfully **********")
}).catch((exception) => {
  console.log(exception)
  console.error("Error connecting mongodb")
  process.exit(1)
});