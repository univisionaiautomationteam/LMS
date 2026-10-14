import type { Course } from "../types";

/** Reads the shared course inputs so no page re-implements the field names. */
export function readCourseForm(form: FormData) {
  return {
    title: String(form.get("title") ?? "").trim(),
    category: String(form.get("category") ?? "").trim(),
    description: String(form.get("description") ?? "").trim(),
    level: String(form.get("level") ?? "Beginner"),
    icon: String(form.get("icon") ?? "").trim(),
    lessons: String(form.get("lessons") ?? "").trim(),
    duration: String(form.get("duration") ?? "").trim(),
  };
}

/**
 * The one place the course input markup lives. Admin and teacher pages wrap it
 * in their own <form> so each keeps control of submit handling and layout.
 */
export default function CourseFields({
  initial,
  submitLabel = "Create & publish",
  onCancel,
}: {
  initial?: Course;
  submitLabel?: string;
  onCancel?: () => void;
}) {
  return (
    <>
      <div className="form-row">
        <label>
          Course title
          <input name="title" required defaultValue={initial?.title} placeholder="e.g. Aerospace Engineering" />
        </label>
        <label>
          Category
          <input name="category" required defaultValue={initial?.category} placeholder="e.g. Aerospace" />
        </label>
      </div>
      <label>
        Description
        <textarea name="description" required defaultValue={initial?.description} placeholder="What will learners build?" />
      </label>
      <div className="form-row">
        <label>
          Level
          <select name="level" defaultValue={initial?.level ?? "Beginner"}>
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>
        </label>
        <label>
          Short icon
          <input name="icon" maxLength={3} defaultValue={initial?.icon} placeholder="AE" />
        </label>
      </div>
      <div className="form-row">
        <label>
          Lessons
          <input name="lessons" type="number" min={1} max={999} defaultValue={initial?.lessons ?? 24} />
        </label>
        <label>
          Duration
          <input name="duration" defaultValue={initial?.duration ?? "8h 00m"} placeholder="8h 00m" />
        </label>
      </div>
      <div className="management-actions">
        <button className="primary-button" type="submit">
          {submitLabel} <span>→</span>
        </button>
        {onCancel && (
          <button className="text-button" type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </>
  );
}
