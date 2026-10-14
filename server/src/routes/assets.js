import { Router, raw } from "express";
import authRequired from "../middleware/auth.js";
import {
  listAssets,
  issueUploadTicket,
  uploadLocalObject,
  getAssetUrl,
  createAsset,
  updateAsset,
  deleteAsset,
} from "../controllers/assetController.js";
import { MAX_UPLOAD_BYTES } from "../services/storage.js";

const router = Router();

router.get("/", authRequired(), listAssets);
router.post("/upload-ticket", authRequired(["admin", "collegeAdmin", "teacher"]), issueUploadTicket);
router.put(
  "/raw/*",
  authRequired(["admin", "collegeAdmin", "teacher"]),
  raw({ type: () => true, limit: MAX_UPLOAD_BYTES }),
  uploadLocalObject
);
router.get("/url/:id", authRequired(), getAssetUrl);
router.post("/", authRequired(["admin", "collegeAdmin", "teacher"]), createAsset);
router.put("/:id", authRequired(["admin", "collegeAdmin", "teacher"]), updateAsset);
router.delete("/:id", authRequired(["admin", "collegeAdmin", "teacher"]), deleteAsset);

export default router;
