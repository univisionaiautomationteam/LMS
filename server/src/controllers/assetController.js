import { Asset } from "../models/Asset.js";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const allowedVideoTypes = new Set(["video/mp4", "video/webm"]);
const allowedDocumentTypes = new Set([
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function listAssets(_req, res) {
  try {
    const assets = await Asset.find().sort({ createdAt: -1 }).limit(100);
    res.json({ assets: assets.map((asset) => asset.toPublic()) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function createAsset(req, res) {
  try {
    const title = String(req.body.title ?? "").trim();
    const course = String(req.body.course ?? "").trim();
    const kind = req.body.kind === "document" ? "document" : "video";
    if (!title || !course) return res.status(400).json({ error: "Content title and course are required." });
    if (Number(req.body.size) > MAX_UPLOAD_BYTES) return res.status(413).json({ error: "The file exceeds the 100 MB limit." });

    const mimeType = String(req.body.mimeType ?? "");
    const allowed = kind === "video" ? allowedVideoTypes : allowedDocumentTypes;
    if (mimeType && !allowed.has(mimeType)) {
      return res.status(415).json({ error: kind === "video" ? "Use an MP4 or WebM video." : "Use PDF, TXT, DOC, or DOCX." });
    }

    const asset = await Asset.create({
      title,
      kind,
      course,
      mimeType,
      size: Number(req.body.size) || 0,
      url: String(req.body.url ?? ""),
      objectKey: String(req.body.objectKey ?? ""),
      createdBy: req.user.email,
    });
    res.status(201).json({ asset: asset.toPublic() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateAsset(req, res) {
  try {
    const title = String(req.body.title ?? "").trim();
    const course = String(req.body.course ?? "").trim();
    if (!title || !course) return res.status(400).json({ error: "Content title and course are required." });
    const asset = await Asset.findByIdAndUpdate(req.params.id, { title, course }, { new: true });
    if (!asset) return res.status(404).json({ error: "Content was not found." });
    res.json({ asset: asset.toPublic() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteAsset(req, res) {
  try {
    const asset = await Asset.findByIdAndDelete(req.params.id);
    if (!asset) return res.status(404).json({ error: "Content was not found." });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
