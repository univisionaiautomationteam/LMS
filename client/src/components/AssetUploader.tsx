import { useState } from "react";
import { api, uploadFile } from "../api/client";
import type { Asset, Course } from "../types";
import { useToast } from "../context/ToastContext";

// Keep in step with MAX_UPLOAD_BYTES on the server (1 GB).
const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;
const MAX_UPLOAD_LABEL = "1 GB";

export default function AssetUploader({
  courses,
  onUploaded,
  heading = "Add course content",
  subheading = "Reference videos and documents for learners.",
}: {
  courses: Course[];
  onUploaded: (asset: Asset) => void;
  heading?: string;
  subheading?: string;
}) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { success, error } = useToast();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    const file = selectedFile;
    if (!(file instanceof File) || !file.size) {
      setStatus("Choose a file to upload.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setStatus(`That file is too large. The limit is ${MAX_UPLOAD_LABEL}.`);
      return;
    }

    const assetTitle = String(form.get("title") ?? "").trim();
    const course = String(form.get("course") ?? "").trim();
    const kind = String(form.get("kind") ?? "video");

    if (!assetTitle) {
      setStatus("Content title is required.");
      return;
    }
    if (!course) {
      setStatus("Please select a course.");
      return;
    }

    setBusy(true);
    setProgress(0);
    try {
      setStatus("Requesting a secure upload slot…");
      const ticket = await api.createUploadTicket({
        title: assetTitle,
        course,
        kind,
        mimeType: file.type,
        size: file.size,
        filename: file.name,
      });

      setStatus(`Uploading ${file.name}…`);
      await uploadFile(ticket, file, (pct) => setProgress(pct));

      // The asset row is only created once the bytes are safely in storage.
      const { asset } = await api.createAsset({
        title: assetTitle,
        course,
        kind,
        mimeType: file.type,
        size: file.size,
        objectKey: ticket.objectKey,
        url: ticket.assetUrl,
      });
      onUploaded(asset);
      formElement.reset();
      setSelectedFile(null);
      setProgress(100);
      setStatus("Published to the course library.");
      success("Upload complete", `“${assetTitle}” has been published.`);
    } catch (err: any) {
      setProgress(0);
      const msg = err?.message ?? "Upload failed.";
      setStatus(msg);
      error("Upload failed", msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="upload-card" onSubmit={submit}>
      <div className="upload-head">
        <span className="upload-symbol">↑</span>
        <div>
          <h2>{heading}</h2>
          <p>{subheading}</p>
        </div>
      </div>
      <label>
        Content title
        <input name="title" required placeholder="e.g. Introduction to embedded systems" />
      </label>
      <div className="form-row">
        <label>
          Course
          <select name="course" defaultValue={courses[0]?.slug}>
            {courses.map((course) => (
              <option key={course.slug} value={course.slug}>
                {course.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Content type
          <select name="kind" defaultValue="video">
            <option value="video">Recorded video</option>
            <option value="document">Course document</option>
          </select>
        </label>
      </div>
      <label className="file-drop">
        <input
          name="file"
          type="file"
          accept="video/mp4,video/webm,application/pdf,text/plain,.doc,.docx"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setSelectedFile(f);
            setStatus("");
          }}
        />
        {selectedFile ? (
          <div className="file-selected">
            <span>📄 {selectedFile.name}</span>
            <button
              type="button"
              className="file-remove"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedFile(null);
                setStatus("");
              }}
              aria-label="Remove selected file"
            >
              ×
            </button>
          </div>
        ) : (
          <span>Choose a video or document</span>
        )}
        <small>MP4, WebM, PDF, TXT, DOC or DOCX · up to {MAX_UPLOAD_LABEL}</small>
      </label>
      {progress > 0 && progress < 100 && (
        <div className="upload-progress">
          <div className="upload-progress-bar" style={{ width: `${progress}%` }} />
          <span className="upload-progress-text">{progress}%</span>
        </div>
      )}
      <button className="primary-button" type="submit" disabled={busy}>
        {busy ? "Uploading…" : "Upload & publish"}
        {!busy && <span>→</span>}
      </button>
      {status && <p className="form-status" role="status">{status}</p>}
    </form>
  );
}
