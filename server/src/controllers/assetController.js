import { Asset } from "../models/Asset.js";
import { Course } from "../models/Course.js";
import { serverError } from "../utils/helpers.js";
import { resolveCourseAccess, assetScopeFilter, canManageAsset, canManageCourse } from "../utils/access.js";
import { collegeVisibilityFilter } from "../utils/scope.js";
import {
  createUploadTicket,
  signDownloadUrl,
  writeLocalObject,
  isSafeObjectKey,
  storageMode,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
} from "../services/storage.js";

const MAX_UPLOAD_BYTES_LIMIT = MAX_UPLOAD_BYTES;
const allowedVideoTypes = new Set(["video/mp4", "video/webm"]);
const allowedDocumentTypes = new Set([
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function allowedTypesFor(kind) {
  return kind === "video" ? allowedVideoTypes : allowedDocumentTypes;
}

/**
 * A teacher's content belongs to a course they own; admins may publish into
 * any course. Returns the course doc when the write is allowed, or `null`
 * after sending a refusal response (so the caller can stamp `collegeId`).
 */
async function resolveManagedCourse(req, res, courseSlug) {
  const courseDoc = await Course.findOne({ slug: courseSlug });
  if (!courseDoc) {
    res.status(404).json({ error: "That course no longer exists." });
    return null;
  }
  if (!canManageCourse(req.user, courseDoc)) {
    res.status(403).json({ error: "You can only add content to courses you created." });
    return null;
  }
  return courseDoc;
}

export async function listAssets(req, res) {
  try {
    const access = await resolveCourseAccess(req.user);
    const conditions = [assetScopeFilter(access), collegeVisibilityFilter(req.user, "collegeId")].filter(
      (filter) => Object.keys(filter).length
    );
    const filter = conditions.length ? { $and: conditions } : {};
    const assets = await Asset.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json({ assets: assets.map((asset) => asset.toPublic()) });
  } catch (error) {
    serverError(res, error, "assets.list");
  }
}

/** Hands the browser a short-lived, storage-enforced ticket for a direct upload. */
export async function issueUploadTicket(req, res) {
  try {
    const title = String(req.body.title ?? "").trim();
    const course = String(req.body.course ?? "").trim();
    const filename = String(req.body.filename ?? "").trim();
    const kind = req.body.kind === "document" ? "document" : "video";
    const mimeType = String(req.body.mimeType ?? "");
    const size = Number(req.body.size) || 0;

    if (!title || !course || !filename) {
      return res.status(400).json({ error: "Title, course and file name are required." });
    }
    if (!allowedTypesFor(kind).has(mimeType)) {
      return res.status(415).json({
        error: kind === "video" ? "Use an MP4 or WebM video." : "Use PDF, TXT, DOC, or DOCX.",
      });
    }
    if (size > MAX_UPLOAD_BYTES_LIMIT) {
      return res.status(413).json({ error: `The file exceeds the ${MAX_UPLOAD_LABEL} limit.` });
    }
    const managed = await resolveManagedCourse(req, res, course);
    if (!managed) return;

    const ticket = await createUploadTicket({ course, kind, mimeType, filename });
    res.json(ticket);
  } catch (error) {
    serverError(res, error, "assets.issueTicket");
  }
}

/** Local-storage fallback path; unused when an S3 bucket is configured. */
export async function uploadLocalObject(req, res) {
  try {
    if (storageMode() !== "local") return res.status(404).json({ error: "Not found." });
    const objectKey = req.params[0];
    if (!isSafeObjectKey(objectKey)) return res.status(400).json({ error: "Invalid object key." });
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: "The request body must contain the file." });
    }
    if (req.body.length > MAX_UPLOAD_BYTES_LIMIT) {
      return res.status(413).json({ error: `The file exceeds the ${MAX_UPLOAD_LABEL} limit.` });
    }
    await writeLocalObject(objectKey, req.body);
    res.status(201).json({ ok: true, objectKey });
  } catch (error) {
    serverError(res, error, "assets.uploadLocal");
  }
}

/** Returns a fresh, time-limited URL so private buckets stay private. */
export async function getAssetUrl(req, res) {
  try {
    const access = await resolveCourseAccess(req.user);
    const conditions = [
      { _id: req.params.id },
      assetScopeFilter(access),
      collegeVisibilityFilter(req.user, "collegeId"),
    ].filter((filter) => Object.keys(filter).length);
    const asset = await Asset.findOne({ $and: conditions });
    if (!asset) return res.status(404).json({ error: "Content was not found." });
    if (!asset.objectKey) return res.status(409).json({ error: "This item has no stored file." });
    res.json({ url: await signDownloadUrl(asset.objectKey), expiresIn: 900 });
  } catch (error) {
    serverError(res, error, "assets.getUrl");
  }
}

export async function createAsset(req, res) {
  try {
    const title = String(req.body.title ?? "").trim();
    const course = String(req.body.course ?? "").trim();
    const kind = req.body.kind === "document" ? "document" : "video";
    if (!title || !course) return res.status(400).json({ error: "Content title and course are required." });
    if (Number(req.body.size) > MAX_UPLOAD_BYTES_LIMIT) return res.status(413).json({ error: `The file exceeds the ${MAX_UPLOAD_LABEL} limit.` });

    const mimeType = String(req.body.mimeType ?? "");
    const allowed = allowedTypesFor(kind);
    if (mimeType && !allowed.has(mimeType)) {
      return res.status(415).json({ error: kind === "video" ? "Use an MP4 or WebM video." : "Use PDF, TXT, DOC, or DOCX." });
    }

    const objectKey = String(req.body.objectKey ?? "");
    if (objectKey && !isSafeObjectKey(objectKey)) {
      return res.status(400).json({ error: "Invalid object key." });
    }
    const managed = await resolveManagedCourse(req, res, course);
    if (!managed) return;

    const asset = await Asset.create({
      title,
      kind,
      course,
      lessonKey: String(req.body.lessonKey ?? "").trim(),
      mimeType,
      size: Number(req.body.size) || 0,
      url: String(req.body.url ?? ""),
      objectKey,
      createdBy: req.user.email,
      collegeId: managed.collegeId ?? req.user.collegeId ?? null,
    });
    res.status(201).json({ asset: asset.toPublic() });
  } catch (error) {
    serverError(res, error, "assets.create");
  }
}

export async function updateAsset(req, res) {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ error: "Content was not found." });
    if (!canManageAsset(req.user, asset)) {
      return res.status(403).json({ error: "You can only edit content that you uploaded." });
    }

    const title = String(req.body.title ?? "").trim();
    const course = String(req.body.course ?? "").trim();
    if (!title || !course) return res.status(400).json({ error: "Content title and course are required." });
    asset.title = title;
    asset.course = course;
    await asset.save();
    res.json({ asset: asset.toPublic() });
  } catch (error) {
    serverError(res, error, "assets.update");
  }
}

export async function deleteAsset(req, res) {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ error: "Content was not found." });
    if (!canManageAsset(req.user, asset)) {
      return res.status(403).json({ error: "You can only delete content that you uploaded." });
    }
    await asset.deleteOne();
    res.json({ ok: true });
  } catch (error) {
    serverError(res, error, "assets.delete");
  }
}
