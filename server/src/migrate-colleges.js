import "dotenv/config";
import mongoose from "mongoose";
import { Course } from "./models/Course.js";
import { Asset } from "./models/Asset.js";
import { College } from "./models/College.js";

/**
 * One-time migration for the multi-tenant rollout. Existing courses and assets
 * predate `collegeId`, so they are explicitly stamped as platform-wide (`null`)
 * — visible to every college — rather than being silently owned by whichever
 * college happens to be created first. Legacy colleges also get an empty
 * `domains` array so the field is never missing.
 */
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lms";

async function migrate() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    const courseResult = await Course.updateMany(
      { collegeId: { $exists: false } },
      { $set: { collegeId: null } }
    );
    const assetResult = await Asset.updateMany(
      { collegeId: { $exists: false } },
      { $set: { collegeId: null } }
    );
    const collegeResult = await College.updateMany(
      { domains: { $exists: false } },
      { $set: { domains: [] } }
    );

    console.log(`Courses stamped platform-wide: ${courseResult.modifiedCount}`);
    console.log(`Assets stamped platform-wide: ${assetResult.modifiedCount}`);
    console.log(`Colleges given a domains array: ${collegeResult.modifiedCount}`);
    console.log("Migration complete.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

migrate();
