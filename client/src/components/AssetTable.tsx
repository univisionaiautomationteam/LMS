import { useState } from "react";
import { api } from "../api/client";
import type { Asset, Course } from "../types";
import { formatBytes } from "../data/constants";
import { useToast } from "../context/ToastContext";

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
  canManage?: (asset: Asset) => boolean;
  onUpdated?: (asset: Asset) => void;
  onDeleted?: (asset: Asset) => void;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const { success, error } = useToast();

  async function open(asset: Asset) {
    try {
      const url = asset.objectKey ? (await api.assetUrl(asset._id)).url : asset.url;
      if (!url) {
        setStatus("This item has no stored file.");
        return;
      }
      window.open(url, "_blank", "noopener");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not open that file.";
      setStatus(msg);
      error("Open failed", msg);
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
      success("Asset updated", `“${asset.title}” has been saved.`);
      onUpdated?.(asset);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed.";
      setStatus(msg);
      error("Update failed", msg);
    }
  }

  async function remove(asset: Asset) {
    if (!window.confirm(`Permanently delete “${asset.title}”?`)) return;
    try {
      await api.deleteAsset(asset._id);
      setStatus("Content deleted.");
      success("Asset deleted", `“${asset.title}” has been removed.`);
      onDeleted?.(asset);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed.";
      setStatus(msg);
      error("Delete failed", msg);
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
          <div className="asset-row" key={asset._id} style={{ alignItems: "center" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <i className={asset.kind}>{asset.kind === "video" ? "▶" : "DOC"}</i>
              <strong>{asset.title}</strong>
            </span>
            <span>{courses.find((c) => c.slug === asset.course)?.title ?? asset.course}</span>
            <span style={{ textTransform: "capitalize" }}>{asset.kind}</span>
            <span>{formatBytes(asset.size)}</span>
            <span className="asset-actions" style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <button type="button" onClick={() => open(asset)} style={{ padding: "4px 8px" }}>Open</button>
              {manageable && <button type="button" onClick={() => setEditingId(asset._id)} style={{ padding: "4px 8px" }}>Edit</button>}
              {manageable && <button className="danger-link" type="button" onClick={() => remove(asset)} style={{ padding: "4px 8px" }}>Delete</button>}
            </span>
          </div>
        );
      })}
      {status && <p className="form-status" role="status">{status}</p>}
    </div>
  );
}
