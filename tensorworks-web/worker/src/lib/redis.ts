import IORedis from "ioredis";

export const redis = new IORedis(process.env.REDIS_URL!, {
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // required for BullMQ
});
