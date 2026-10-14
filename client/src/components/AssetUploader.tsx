import { useState } from "react";
import { api, uploadFile } from "../api/client";
import type { Asset, Course } from "../types";

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

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("file");
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

    setBusy(true);
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
      await uploadFile(ticket, file);

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
      setStatus("Published to the course library.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Upload failed.");
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
          required
          accept="video/mp4,video/webm,application/pdf,text/plain,.doc,.docx"
        />
        <span>Choose a video or document</span>
        <small>MP4, WebM, PDF, TXT, DOC or DOCX · up to {MAX_UPLOAD_LABEL}</small>
      </label>
      <button className="primary-button" type="submit" disabled={busy}>
        {busy ? "Uploading…" : "Upload & publish"}
        {!busy && <span>→</span>}
      </button>
      {status && <p className="form-status" role="status">{status}</p>}
    </form>
  );
}
