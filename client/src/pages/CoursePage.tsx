import { useState } from "react";
import type { Asset, Course } from "../types";
import { curriculum, formatBytes } from "../data/constants";

export default function CoursePage({
  course,
  assets,
  onOpenPractice,
}: {
  course: Course;
  assets: Asset[];
  onOpenPractice: () => void;
}) {
  const [lesson, setLesson] = useState(0);
  const [tab, setTab] = useState<"overview" | "resources" | "notes">("overview");

  if (!course) return <div className="page-content"><p>Course not found.</p></div>;

  const courseAssets = assets.filter(
    (a) => a.course.toLowerCase() === course.language.toLowerCase() || a.course.toLowerCase() === course.slug
  );
  const activeVideo = courseAssets.find((a) => a.kind === "video");
  const documents = courseAssets.filter((a) => a.kind === "document");

  return (
    <div className="course-layout">
      <section className="player-column">
        <div className="video-frame">
          {activeVideo?.url ? (
            <video key={activeVideo._id} controls preload="metadata" src={activeVideo.url} />
          ) : (
            <div className="video-placeholder">
              <span className="play-button">▶</span>
              <strong>{curriculum[lesson].title}</strong>
              <small>Upload a recorded lesson in Instructor Studio to stream it here.</small>
            </div>
          )}
        </div>
        <div className="lesson-title-row">
          <div><span className="eyebrow">Lesson {lesson + 1} of {curriculum.length}</span><h1>{curriculum[lesson].title}</h1></div>
          <button className="complete-button">✓ Mark complete</button>
        </div>
        <div className="tab-row" role="tablist">
          {(["overview", "resources", "notes"] as const).map((t) => (
            <button role="tab" aria-selected={tab === t} className={tab === t ? "active" : ""} onClick={() => setTab(t)} key={t}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        {tab === "overview" && (
          <div className="lesson-copy">
            <h2>What you'll learn</h2>
            <p>This lesson turns theory into understanding. Follow the explanation, pause to predict each result, and apply the concept through practical work.</p>
            <div className="outcome-grid">
              <span>✓ Understand the core concept</span><span>✓ Connect theory to application</span>
              <span>✓ Identify common mistakes</span><span>✓ Apply concepts in a mini task</span>
            </div>
            <button className="inline-lab" onClick={onOpenPractice}>Open practical lab <b>→</b></button>
          </div>
        )}
        {tab === "resources" && (
          <div className="resource-list">
            <h2>Lesson resources</h2>
            {documents.length ? (
              documents.map((asset) => (
                <a href={asset.url || "#"} target="_blank" rel="noreferrer" key={asset._id}>
                  <span className="doc-icon">DOC</span>
                  <span><strong>{asset.title}</strong><small>{asset.mimeType} · {formatBytes(asset.size)}</small></span>
                  <b>Open ↗</b>
                </a>
              ))
            ) : (
              <div className="empty-state">No documents have been uploaded for this course yet.</div>
            )}
          </div>
        )}
        {tab === "notes" && (
          <div className="notes-panel">
            <h2>Private notes</h2>
            <textarea aria-label="Private lesson notes" placeholder="Write a takeaway, code snippet, or reminder…" />
            <div><small>Notes remain private to your learning workspace.</small><button className="primary-small">Save note</button></div>
          </div>
        )}
      </section>
      <aside className="curriculum-panel">
        <div className="curriculum-head">
          <span className="eyebrow">Course</span>
          <h2>{course.title}</h2>
          <div className="progress-track thin"><span style={{ width: `${Math.max(course.progress || 0, 12)}%` }} /></div>
          <small>{Math.max(course.progress || 0, 12)}% complete</small>
        </div>
        <div className="module-label"><span>Module 1</span><strong>Programming foundations</strong></div>
        {curriculum.map((item, index) => (
          <button className={`lesson-item ${lesson === index ? "active" : ""}`} key={item.title} onClick={() => setLesson(index)}>
            <span className="lesson-state">{index < lesson ? "✓" : index + 1}</span>
            <span><strong>{item.title}</strong><small>{item.type === "video" ? "▶" : item.type === "quiz" ? "?" : "⌘"} {item.time}</small></span>
          </button>
        ))}
        <button className="quiz-cta" onClick={onOpenPractice}>Practice what you learned <span>→</span></button>
      </aside>
    </div>
  );
}
