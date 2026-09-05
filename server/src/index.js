import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import authRoutes from "./routes/auth.js";
import courseRoutes from "./routes/courses.js";
import userRoutes from "./routes/users.js";
import collegeRoutes from "./routes/colleges.js";
import assetRoutes from "./routes/assets.js";
import codeRoutes from "./routes/code.js";
import dashboardRoutes from "./routes/dashboard.js";

const app = express();

app.use(cors({ origin: (process.env.CORS_ORIGIN || "*").split(",") }));
app.use(express.json({ limit: "2mb" }));

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

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message ?? "Unexpected server error." });
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lms";

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`Connected to MongoDB: ${MONGODB_URI}`);
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error.message);
  }
  app.listen(PORT, () => {
    console.log(`LMS server running on http://localhost:${PORT}`);
  });
}

start();
