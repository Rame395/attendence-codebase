import {config} from 'dotenv'
config();

export const MongoConfig = {
  url: process.env.MONGO_URI,
  name: process.env.MONGO_NAME,
};


export const AppConfig = {
    assestsUrl: process.env.ASSEST_URL,
  jwtSecret: process.env.JWT_SECRET,
};