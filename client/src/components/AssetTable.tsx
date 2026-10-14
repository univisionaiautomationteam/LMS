import { useState } from "react";
import { api } from "../api/client";
import type { Asset, Course } from "../types";
import { formatBytes } from "../data/constants";

export default function AssetTable({
  assets,
  courses,
  canManage,
  onUpdated,
  onDeleted,
  emptyTitle = "Your library is ready",
  emptyBody = "Upload the first recorded lesson or course document to begin.",
}: {
  assets: Asset[];
  courses: Course[];
  /** Rows the viewer may edit or delete. Omit to allow everything shown. */
  canManage?: (asset: Asset) => boolean;
  onUpdated?: (asset: Asset) => void;
  onDeleted?: (asset: Asset) => void;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  async function open(asset: Asset) {
    try {
      // Private buckets hand out short-lived URLs, so resolve one per click.
      const url = asset.objectKey ? (await api.assetUrl(asset._id)).url : asset.url;
      if (!url) {
        setStatus("This item has no stored file.");
        return;
      }
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not open that file.");
    }
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      const { asset } = await api.updateAsset(String(form.get("id") ?? ""), {
        title: form.get("title"),
        course: form.get("course"),
      });
      setEditingId(null);
      setStatus(`Updated “${asset.title}”.`);
      onUpdated?.(asset);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Update failed.");
    }
  }

  async function remove(asset: Asset) {
    if (!window.confirm(`Permanently delete “${asset.title}”?`)) return;
    try {
      await api.deleteAsset(asset._id);
      setStatus("Content deleted.");
      onDeleted?.(asset);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  if (!assets.length) {
    return (
      <div className="empty-library">
        <span>□</span>
        <h3>{emptyTitle}</h3>
        <p>{emptyBody}</p>
      </div>
    );
  }

  return (
    <div className="asset-table">
      <div className="asset-row asset-header">
        <span>Content</span>
        <span>Course</span>
        <span>Type</span>
        <span>Size</span>
        <span>Actions</span>
      </div>
      {assets.map((asset) => {
        const manageable = canManage ? canManage(asset) : true;
        if (editingId === asset._id) {
          return (
            <form className="asset-edit-row" key={asset._id} onSubmit={save}>
              <input type="hidden" name="id" value={asset._id} />
              <label>
                Content title
                <input name="title" defaultValue={asset.title} required />
              </label>
              <label>
                Course
                <select name="course" defaultValue={asset.course}>
                  {courses.map((course) => (
                    <option value={course.slug} key={course.slug}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="management-actions">
                <button className="primary-small" type="submit">Save</button>
                <button className="text-button" type="button" onClick={() => setEditingId(null)}>Cancel</button>
              </div>
            </form>
          );
        }
        return (
          <div className="asset-row" key={asset._id}>
            <span>
              <i className={asset.kind}>{asset.kind === "video" ? "▶" : "DOC"}</i>
              <strong>{asset.title}</strong>
            </span>
            <span>{courses.find((c) => c.slug === asset.course)?.title ?? asset.course}</span>
            <span>{asset.kind}</span>
            <span>{formatBytes(asset.size)}</span>
            <span className="asset-actions">
              <button type="button" onClick={() => open(asset)}>Open</button>
              {manageable && <button type="button" onClick={() => setEditingId(asset._id)}>Edit</button>}
              {manageable && <button className="danger-link" type="button" onClick={() => remove(asset)}>Delete</button>}
            </span>
          </div>
        );
      })}
      {status && <p className="form-status" role="status">{status}</p>}
    </div>
  );
}
