import { useState } from "react";
import { api, uploadFile } from "../api/client";
import type { Asset, Course, CourseModule, Lesson, LessonQuiz, LessonQuizQuestion } from "../types";

// Keep in step with MAX_UPLOAD_BYTES on the server (1 GB).
const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;
const MAX_UPLOAD_LABEL = "1 GB";
const LESSON_TYPES: Lesson["type"][] = ["video", "document", "code", "quiz"];

const randomKey = () => `l-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function blankQuestion(): LessonQuizQuestion {
  return { prompt: "", options: ["", "", "", ""], answer: 0 };
}

function blankQuiz(): LessonQuiz {
  return { title: "Module knowledge check", passScore: 60, questions: [blankQuestion()] };
}

function blankLesson(type: Lesson["type"] = "video"): Lesson {
  return { key: randomKey(), title: "", type, duration: "", assetId: null, quiz: type === "quiz" ? blankQuiz() : null };
}

/** Start from the authored modules, or wrap any legacy flat outline into one. */
function seed(course: Course): CourseModule[] {
  if (course.modules?.length) return JSON.parse(JSON.stringify(course.modules)) as CourseModule[];
  const lessons: Lesson[] = course.curriculum?.length
    ? (JSON.parse(JSON.stringify(course.curriculum)) as Lesson[])
    : [blankLesson("video")];
  return [{ moduleId: `m-${Date.now().toString(36)}`, title: "Module 1", order: 0, lessons }];
}

/**
 * Authoring surface for a course's modules and lessons. Videos/documents are
 * uploaded per-lesson (the asset records the lesson key) and quizzes are written
 * inline; nothing is persisted until Save, which normalises and stores the tree.
 */
export default function CurriculumBuilder({
  course,
  onSaved,
  onAssetUploaded,
  onClose,
}: {
  course: Course;
  onSaved: (course: Course) => void;
  onAssetUploaded?: (asset: Asset) => void;
  onClose?: () => void;
}) {
  const [modules, setModules] = useState<CourseModule[]>(() => seed(course));
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState("");

  function patchModule(index: number, patch: Partial<CourseModule>) {
    setModules((current) => current.map((module, i) => (i === index ? { ...module, ...patch } : module)));
  }

  function patchLesson(mi: number, li: number, patch: Partial<Lesson>) {
    setModules((current) =>
      current.map((module, i) =>
        i === mi ? { ...module, lessons: module.lessons.map((lesson, j) => (j === li ? { ...lesson, ...patch } : lesson)) } : module
      )
    );
  }

  function patchQuiz(mi: number, li: number, patch: Partial<LessonQuiz>) {
    setModules((current) =>
      current.map((module, i) =>
        i === mi
          ? {
              ...module,
              lessons: module.lessons.map((lesson, j) =>
                j === li ? { ...lesson, quiz: { ...(lesson.quiz ?? blankQuiz()), ...patch } } : lesson
              ),
            }
          : module
      )
    );
  }

  function patchQuestion(mi: number, li: number, qi: number, patch: Partial<LessonQuizQuestion>) {
    setModules((current) =>
      current.map((module, i) =>
        i === mi
          ? {
              ...module,
              lessons: module.lessons.map((lesson, j) => {
                if (j !== li || !lesson.quiz) return lesson;
                return { ...lesson, quiz: { ...lesson.quiz, questions: lesson.quiz.questions.map((q, k) => (k === qi ? { ...q, ...patch } : q)) } };
              }),
            }
          : module
      )
    );
  }

  function addModule() {
    setModules((current) => [
      ...current,
      { moduleId: `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, title: `Module ${current.length + 1}`, order: current.length, lessons: [blankLesson("video")] },
    ]);
  }

  function addLesson(mi: number, type: Lesson["type"]) {
    setModules((current) => current.map((module, i) => (i === mi ? { ...module, lessons: [...module.lessons, blankLesson(type)] } : module)));
  }

  function removeModule(mi: number) {
    setModules((current) => current.filter((_, i) => i !== mi));
  }

  function removeLesson(mi: number, li: number) {
    setModules((current) => current.map((module, i) => (i === mi ? { ...module, lessons: module.lessons.filter((_, j) => j !== li) } : module)));
  }

  async function upload(mi: number, li: number, file: File) {
    const lesson = modules[mi]?.lessons[li];
    if (!lesson) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setStatus(`That file is too large. The limit is ${MAX_UPLOAD_LABEL}.`);
      return;
    }
    const kind = lesson.type === "document" ? "document" : "video";
    const title = lesson.title.trim() || file.name;
    setUploadingKey(lesson.key);
    try {
      setStatus(`Uploading ${file.name}…`);
      const ticket = await api.createUploadTicket({
        title,
        course: course.slug,
        kind,
        lessonKey: lesson.key,
        mimeType: file.type,
        size: file.size,
        filename: file.name,
      });
      await uploadFile(ticket, file);
      const { asset } = await api.createAsset({
        title,
        course: course.slug,
        kind,
        lessonKey: lesson.key,
        mimeType: file.type,
        size: file.size,
        objectKey: ticket.objectKey,
        url: ticket.assetUrl,
      });
      patchLesson(mi, li, { assetId: asset._id });
      onAssetUploaded?.(asset);
      setStatus(`Linked ${file.name} to “${lesson.title || "lesson"}”.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadingKey("");
    }
  }

  async function save() {
    setSaving(true);
    setStatus("Saving curriculum…");
    try {
      const { course: updated } = await api.saveCurriculum(course._id ?? course.slug, modules);
      onSaved(updated);
      setStatus("Curriculum saved. Learners will see the new structure immediately.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not save the curriculum.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="curriculum-builder">
      <div className="builder-head">
        <div>
          <span className="eyebrow accent">Curriculum</span>
          <h3>{course.title}</h3>
          <small>Build modules, attach a file to each lesson, and write the module quiz.</small>
        </div>
        <div className="builder-head-actions">
          {onClose && <button className="text-button" type="button" onClick={onClose}>Close</button>}
          <button className="primary-small" type="button" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save curriculum"}
          </button>
        </div>
      </div>

      {modules.map((module, mi) => (
        <section className="builder-module" key={module.moduleId}>
          <div className="builder-module-head">
            <label>
              Module title
              <input value={module.title} onChange={(e) => patchModule(mi, { title: e.target.value })} placeholder={`Module ${mi + 1}`} />
            </label>
            <button className="danger-button" type="button" onClick={() => removeModule(mi)} disabled={modules.length === 1}>Remove module</button>
          </div>

          {module.lessons.map((lesson, li) => {
            const quiz = lesson.quiz ?? blankQuiz();
            return (
              <div className="builder-lesson" key={lesson.key}>
                <div className="builder-lesson-fields">
                  <label>
                    Lesson title
                    <input value={lesson.title} onChange={(e) => patchLesson(mi, li, { title: e.target.value })} placeholder="e.g. Reading sensor data" />
                  </label>
                  <label>
                    Type
                    <select
                      value={lesson.type}
                      onChange={(e) =>
                        patchLesson(mi, li, {
                          type: e.target.value as Lesson["type"],
                          ...(e.target.value === "quiz" && !lesson.quiz ? { quiz: blankQuiz() } : {}),
                        })
                      }
                    >
                      {LESSON_TYPES.map((type) => <option value={type} key={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}
                    </select>
                  </label>
                  <label>
                    Duration
                    <input value={lesson.duration} onChange={(e) => patchLesson(mi, li, { duration: e.target.value })} placeholder="e.g. 12:30" />
                  </label>
                  <button className="text-button" type="button" onClick={() => removeLesson(mi, li)}>Remove</button>
                </div>

                {lesson.type === "quiz" ? (
                  <div className="builder-quiz">
                    <div className="form-row">
                      <label>
                        Quiz title
                        <input value={quiz.title} onChange={(e) => patchQuiz(mi, li, { title: e.target.value })} />
                      </label>
                      <label>
                        Pass score (%)
                        <input type="number" min={0} max={100} value={quiz.passScore} onChange={(e) => patchQuiz(mi, li, { passScore: Number(e.target.value) })} />
                      </label>
                    </div>
                    {quiz.questions.map((question, qi) => (
                      <div className="builder-question" key={qi}>
                        <input
                          className="question-prompt"
                          value={question.prompt}
                          onChange={(e) => patchQuestion(mi, li, qi, { prompt: e.target.value })}
                          placeholder={`Question ${qi + 1}`}
                        />
                        {question.options.map((option, oi) => (
                          <label className="question-option" key={oi}>
                            <input
                              type="radio"
                              name={`${lesson.key}-${qi}`}
                              checked={question.answer === oi}
                              onChange={() => patchQuestion(mi, li, qi, { answer: oi })}
                            />
                            <input
                              value={option}
                              onChange={(e) =>
                                patchQuestion(mi, li, qi, {
                                  options: question.options.map((o, k) => (k === oi ? e.target.value : o)),
                                })
                              }
                              placeholder={`Option ${oi + 1}`}
                            />
                          </label>
                        ))}
                        <button
                          className="text-button"
                          type="button"
                          onClick={() =>
                            patchQuiz(mi, li, {
                              questions: quiz.questions.filter((_, k) => k !== qi).map((q) => q),
                            })
                          }
                          disabled={quiz.questions.length === 1}
                        >
                          Remove question
                        </button>
                      </div>
                    ))}
                    <button
                      className="outline-small"
                      type="button"
                      onClick={() => patchQuiz(mi, li, { questions: [...quiz.questions, blankQuestion()] })}
                    >
                      + Add question
                    </button>
                  </div>
                ) : (
                  <div className="builder-file">
                    {lesson.assetId ? (
                      <>
                        <span className="file-linked">✓ File linked</span>
                        <button className="text-button" type="button" onClick={() => patchLesson(mi, li, { assetId: null })}>Unlink</button>
                      </>
                    ) : (
                      <span className="file-hint">
                        {uploadingKey === lesson.key ? "Uploading…" : `Attach a ${lesson.type === "document" ? "document" : "video"} (up to ${MAX_UPLOAD_LABEL})`}
                      </span>
                    )}
                    <label className="file-button">
                      <input
                        type="file"
                        accept={lesson.type === "document" ? "application/pdf,text/plain,.doc,.docx" : "video/mp4,video/webm"}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) upload(mi, li, file);
                          e.target.value = "";
                        }}
                      />
                      {lesson.assetId ? "Replace file" : "Choose file"}
                    </label>
                  </div>
                )}
              </div>
            );
          })}

          <div className="builder-add">
            <span>Add lesson:</span>
            {LESSON_TYPES.map((type) => (
              <button className="outline-small" type="button" key={type} onClick={() => addLesson(mi, type)}>
                + {type[0].toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </section>
      ))}

      <button className="outline-small builder-add-module" type="button" onClick={addModule}>+ Add module</button>
      {status && <p className="admin-status" role="status">{status}</p>}
    </div>
  );
}
