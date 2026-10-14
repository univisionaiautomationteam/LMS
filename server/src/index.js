import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";

import authRoutes from "./routes/auth.js";
import courseRoutes from "./routes/courses.js";
import userRoutes from "./routes/users.js";
import collegeRoutes from "./routes/colleges.js";
import assetRoutes from "./routes/assets.js";
import codeRoutes from "./routes/code.js";
import dashboardRoutes from "./routes/dashboard.js";
import teacherRoutes from "./routes/teacher.js";
import progressRoutes from "./routes/progress.js";
import { globalLimiter } from "./middleware/limits.js";
import { serverError } from "./utils/helpers.js";
import { storageMode, localUploadRoot } from "./services/storage.js";

const app = express();

const isProduction = process.env.NODE_ENV === "production";
const origins = (process.env.CORS_ORIGIN || "*").split(",").map((value) => value.trim()).filter(Boolean);

// Rate limiting and `req.ip` are only trustworthy behind exactly one proxy
// hop (ALB / App Runner). Enabling this without a proxy would let a client
// spoof X-Forwarded-For and escape its own limits.
app.set("trust proxy", process.env.TRUST_PROXY ?? (isProduction ? 1 : false));

if (isProduction && (origins.includes("*") || origins.length === 0)) {
  throw new Error('CORS_ORIGIN must list explicit origins when NODE_ENV=production. Refusing to start with "*".');
}
if (isProduction && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set when NODE_ENV=production. Refusing to start.");
}

app.use(helmet());
app.use(cors({ origin: origins }));
app.use(express.json({ limit: "2mb" }));
app.use(globalLimiter);

// Local-storage fallback only. When S3_BUCKET is set, files are served by S3.
if (storageMode() === "local") {
  app.use("/uploads", express.static(localUploadRoot(), { fallthrough: false, index: false }));
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/users", userRoutes);
app.use("/api/colleges", collegeRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/run", codeRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/progress", progressRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.use((err, req, res, _next) => {
  serverError(res, err, `unhandled.${req.method}.${req.path}`);
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lms";

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error.message);
  }
  app.listen(PORT, () => {
    console.log(`LMS server running on http://localhost:${PORT}`);
  });
}

start();
