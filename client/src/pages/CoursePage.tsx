import { useCallback, useEffect, useMemo, useState } from "react";
import type { Asset, Course, CourseProgress, Lesson } from "../types";
import { api } from "../api/client";
import { formatBytes, modulesOf } from "../data/constants";
import QuizPanel from "../components/QuizPanel";
import { useToast } from "../context/ToastContext";

const lessonIcon = (type: Lesson["type"]) => (type === "video" ? "▶" : type === "quiz" ? "?" : type === "document" ? "▤" : "⌘");

export default function CoursePage({
  course,
  assets,
  onOpenPractice,
  progress,
  onRefreshProgress,
}: {
  course: Course;
  assets: Asset[];
  onOpenPractice: () => void;
  progress?: CourseProgress;
  onRefreshProgress: () => void;
}) {
  const [lesson, setLesson] = useState(0);
  const [tab, setTab] = useState<"overview" | "resources" | "notes">("overview");
  const [videoSrc, setVideoSrc] = useState("");
  const [busy, setBusy] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaved, setNoteSaved] = useState("");
  const { success, error } = useToast();

  // A course ships its own modules; the bundled outline is only a fallback for a
  // demo/starter card that never reached the server.
  const modules = useMemo(() => modulesOf(course), [course]);
  const lessons = useMemo(
    () => modules.flatMap((module) => module.lessons.map((item) => ({ ...item, moduleId: module.moduleId, moduleTitle: module.title }))),
    [modules]
  );
  const lessonIndexByKey = useMemo(() => new Map(lessons.map((item, index) => [item.key, index])), [lessons]);

  // Assets store the course *slug*, so that is the only field worth matching on.
  const slug = (course?.slug ?? "").toLowerCase();
  const courseAssets = useMemo(() => assets.filter((a) => a.course.toLowerCase() === slug), [assets, slug]);
  const courseVideo = courseAssets.find((a) => a.kind === "video");
  const documents = courseAssets.filter((a) => a.kind === "document");

  const activeLesson = lessons[Math.min(lesson, lessons.length - 1)];
  // Prefer the lesson's own file; fall back to the course video for legacy
  // lessons that predate per-lesson linking, so a single upload still plays.
  const lessonAsset =
    (activeLesson?.assetId ? assets.find((a) => a._id === activeLesson.assetId) : null) ??
    (activeLesson?.type === "video" ? courseVideo ?? null : null);

  const completed = useMemo(() => new Set(progress?.completedLessons ?? []), [progress]);
  const percent = progress?.percent ?? 0;
  const isQuiz = activeLesson?.type === "quiz";
  const done = completed.has(activeLesson?.key ?? "");

  // Private buckets issue short-lived URLs, so resolve one whenever the lesson changes.
  useEffect(() => {
    let cancelled = false;
    if (isQuiz || !lessonAsset) {
      setVideoSrc("");
      return;
    }
    if (!lessonAsset.objectKey) {
      setVideoSrc(lessonAsset.url);
      return;
    }
    setVideoSrc("");
    api
      .assetUrl(lessonAsset._id)
      .then(({ url }) => {
        if (!cancelled) setVideoSrc(url);
      })
      .catch(() => {
        if (!cancelled) setVideoSrc("");
      });
    return () => {
      cancelled = true;
    };
  }, [lessonAsset?._id, isQuiz]);

  const openDocument = useCallback(async (asset: Asset) => {
    const url = asset.objectKey ? (await api.assetUrl(asset._id)).url : asset.url;
    if (url) window.open(url, "_blank", "noopener");
  }, []);

  async function toggleComplete() {
    if (!activeLesson) return;
    setBusy(true);
    try {
      await api.setLessonProgress(course.slug, activeLesson.key, !done);
      onRefreshProgress();
    } catch {
      // A failed write leaves the button state unchanged; the next refresh reconciles.
    } finally {
      setBusy(false);
    }
  }

  if (!course) return <div className="page-content"><p>Course not found.</p></div>;

  return (
    <div className="course-layout">
      <section className="player-column">
        {isQuiz ? (
          <QuizPanel courseSlug={course.slug} lessonKey={activeLesson?.key} onPassed={onRefreshProgress} />
        ) : (
          <>
            <div className="video-frame">
              {videoSrc ? (
                <video key={lessonAsset?._id} controls preload="metadata" src={videoSrc} />
              ) : (
                <div className="video-placeholder">
                  <span className="play-button">▶</span>
                  <strong>{activeLesson?.title}</strong>
                  <small>
                    {activeLesson?.type === "video"
                      ? "No recording has been linked to this lesson yet."
                      : "This lesson has no video — follow the notes below."}
                  </small>
                </div>
              )}
            </div>
            <div className="lesson-title-row">
              <div><span className="eyebrow">{activeLesson?.moduleTitle} · Lesson {lesson + 1} of {lessons.length}</span><h1>{activeLesson?.title}</h1></div>
              <button className={`complete-button ${done ? "done" : ""}`} onClick={toggleComplete} disabled={busy}>
                {done ? "✓ Completed" : "✓ Mark complete"}
              </button>
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
                    <a
                      href={asset.url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      key={asset._id}
                      onClick={(e) => {
                        // Signed URLs must be fetched at click time, not from stored markup.
                        e.preventDefault();
                        openDocument(asset).catch(() => {});
                      }}
                    >
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
                <textarea aria-label="Private lesson notes" placeholder="Write a takeaway, code snippet, or reminder…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                <div><small>Notes remain private to your learning workspace.</small><button className="primary-small" type="button" onClick={() => { if (noteText.trim()) { try { localStorage.setItem("lms_note_" + course.slug + "_" + (activeLesson?.key || lesson), noteText); setNoteSaved("Note saved!"); setTimeout(function(){ setNoteSaved(""); }, 2000); } catch(e){} success("Note saved", "Your private note has been saved."); } else { error("Save failed", "Please write something before saving."); } }}>Save note</button></div>
                {noteSaved ? <small style={{ color: "var(--green)" }}>{noteSaved}</small> : null}
              </div>
            )}
          </>
        )}
      </section>
      <aside className="curriculum-panel">
        <div className="curriculum-head">
          <span className="eyebrow">Course</span>
          <h2>{course.title}</h2>
          <div className="progress-track thin"><span style={{ width: `${percent}%` }} /></div>
          <small>{percent}% complete</small>
        </div>
        {modules.map((module) => (
          <div className="module-block" key={module.moduleId}>
            <div className="module-label"><span>{module.lessons.length} lesson{module.lessons.length === 1 ? "" : "s"}</span><strong>{module.title}</strong></div>
            {module.lessons.map((item) => {
              const index = lessonIndexByKey.get(item.key) ?? 0;
              const isDone = completed.has(item.key);
              return (
                <button
                  className={`lesson-item ${lesson === index ? "active" : ""} ${isDone ? "complete" : ""}`}
                  key={item.key}
                  onClick={() => setLesson(index)}
                >
                  <span className="lesson-state">{isDone ? "✓" : index + 1}</span>
                  <span><strong>{item.title}</strong><small>{lessonIcon(item.type)} {item.duration || (item.type === "quiz" ? "Quiz" : "")}</small></span>
                </button>
              );
            })}
          </div>
        ))}
        <button className="quiz-cta" onClick={onOpenPractice}>Practice what you learned <span>→</span></button>
      </aside>
    </div>
  );
}
