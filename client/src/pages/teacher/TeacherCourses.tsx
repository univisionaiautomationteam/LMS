import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "../../api/client";
import CourseFields, { readCourseForm } from "../../components/CourseFields";
import CurriculumBuilder from "../../components/CurriculumBuilder";
import type { Asset, Course, View } from "../../types";
import { useToast } from "../../context/ToastContext";

export default function TeacherCourses({
  setCourses,
  assets,
  setAssets,
  openCourse,
  goTo,
}: {
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  assets: Asset[];
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
  openCourse: (slug: string) => void;
  goTo: (view: View) => void;
}) {
  const [courses, setMyCourses] = useState<Course[] | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [curriculumSlug, setCurriculumSlug] = useState<string | null>(null);
  const { success, error } = useToast();

  useEffect(() => {
    let cancelled = false;
    api
      .listMyCourses()
      .then(({ courses }) => {
        if (!cancelled) setMyCourses(courses);
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus(err instanceof Error ? err.message : "Unable to load your courses.");
          error("Load failed", err instanceof Error ? err.message : "Unable to load your courses.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function assetsFor(slug: string): number {
    return assets.filter((asset) => asset.course === slug).length;
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = readCourseForm(new FormData(e.currentTarget));
    if (!values.title) {
      setStatus("Course title is required.");
      return;
    }
    setBusy(true);
    try {
      const { course } = await api.createCourse(values);
      setMyCourses((cur) => [course, ...(cur ?? [])]);
      setCourses((cur) => [course, ...cur]);
      setCreating(false);
      setStatus(`Course “${course.title}” is live. Upload content from the Content studio.`);
      success("Course created", `“${course.title}” has been published.`);
    } catch (err: any) {
      setStatus(err instanceof Error ? err.message : "Course creation failed.");
      error("Create failed", err instanceof Error ? err.message : "Course creation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const id = String(data.get("id") ?? "");
    setBusy(true);
    try {
      const { course } = await api.updateCourse(id, readCourseForm(data));
      setMyCourses((cur) => (cur ?? []).map((item) => (item.slug === course.slug ? course : item)));
      setCourses((cur) => cur.map((item) => (item.slug === course.slug || item._id === course._id ? course : item)));
      setEditingSlug(null);
      setStatus(`Course “${course.title}” was updated.`);
      success("Course updated", `“${course.title}” has been revised.`);
    } catch (err: any) {
      setStatus(err instanceof Error ? err.message : "Course update failed.");
      error("Update failed", err instanceof Error ? err.message : "Course update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(course: Course) {
    if (!window.confirm(`Delete “${course.title}” from the catalog?`)) return;
    setBusy(true);
    try {
      await api.deleteCourse(course._id ?? course.slug);
      setMyCourses((cur) => (cur ?? []).filter((item) => item.slug !== course.slug));
      setCourses((cur) => cur.filter((item) => item.slug !== course.slug && item._id !== course._id));
      setStatus(`Course “${course.title}” was deleted.`);
      success("Course deleted", `“${course.title}” has been removed.`);
    } catch (err: any) {
      setStatus(err instanceof Error ? err.message : "Course deletion failed.");
      error("Delete failed", err instanceof Error ? err.message : "Course deletion failed.");
    } finally {
      setBusy(false);
    }
  }

  function handleCurriculumSaved(course: Course) {
    setMyCourses((cur) => (cur ?? []).map((item) => (item.slug === course.slug ? course : item)));
    setCourses((cur) => cur.map((item) => (item.slug === course.slug || item._id === course._id ? course : item)));
    setStatus(`Curriculum for “${course.title}” saved.`);
    success("Curriculum saved", `Curriculum for “${course.title}” has been updated.`);
  }

  return (
    <div className="page-content admin-page">
      <section className="page-intro split admin-hero">
        <div>
          <span className="eyebrow accent">My courses</span>
          <h1>Courses you own.</h1>
          <p>Create, revise, and manage your courses. Only you can edit these — other instructors see their own courses in their own portal.</p>
        </div>
        <div className="hero-actions">
          <button className="primary-small" type="button" onClick={() => { setCreating((v) => !v); setEditingSlug(null); }}>
            <Plus size={15} /> {creating ? "Close form" : "New course"}
          </button>
        </div>
      </section>

      {creating && (
        <form className="management-edit teacher-create-form" onSubmit={handleCreate}>
          <h3>Create a new course</h3>
          <CourseFields submitLabel="Create & publish" onCancel={() => setCreating(false)} />
        </form>
      )}

      <section className="management-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Course management</span>
            <h2>{courses === null ? "Loading…" : `${courses.length} ${courses.length === 1 ? "course" : "courses"} in your portal`}</h2>
          </div>
          <button className="text-button" type="button" onClick={() => goTo("teacher")}>
            → Dashboard
          </button>
        </div>

        <div className="management-list">
          {courses !== null && courses.length === 0 && (
            <div className="empty-state">
              You have not created a course yet. Use “New course” above to publish your first one.
            </div>
          )}
          {courses?.map((course) =>
            curriculumSlug === course.slug ? (
              <CurriculumBuilder
                key={course.slug}
                course={course}
                onSaved={handleCurriculumSaved}
                onAssetUploaded={(asset) => setAssets((cur) => [asset, ...cur])}
                onClose={() => setCurriculumSlug(null)}
              />
            ) : editingSlug === course.slug ? (
              <form className="management-edit" key={course.slug} onSubmit={handleUpdate}>
                <input type="hidden" name="id" value={course.slug} />
                <CourseFields initial={course} submitLabel="Save changes" onCancel={() => setEditingSlug(null)} />
              </form>
            ) : (
              <div className="management-item" key={course.slug}>
                <span className="mini-icon" style={{ background: course.color }}>{course.icon}</span>
                <span>
                  <strong>{course.title}</strong>
                  <small>
                    {course.category} · {course.level} · {course.lessons} lessons · {assetsFor(course.slug)} resources
                    {course.updatedAt ? ` · updated ${new Date(course.updatedAt).toLocaleDateString()}` : ""}
                  </small>
                </span>
                <div className="management-actions">
                  <button className="text-button" type="button" onClick={() => { setCurriculumSlug(course.slug); setEditingSlug(null); setCreating(false); }}>Curriculum</button>
                  <button className="text-button" type="button" onClick={() => openCourse(course.slug)}>Open</button>
                  <button className="text-button" type="button" onClick={() => { setEditingSlug(course.slug); setCurriculumSlug(null); setCreating(false); }}>Edit</button>
                  <button className="danger-button" type="button" onClick={() => handleDelete(course)}>Delete</button>
                </div>
              </div>
            )
          )}
        </div>

        <div className="management-links">
          <button className="outline-small" type="button" onClick={() => goTo("admin")}>
            Upload content for these courses →
          </button>
          <button className="outline-small" type="button" onClick={() => goTo("profile")}>
            Update your profile →
          </button>
        </div>
      </section>

      {status && <p className="admin-status" role="status">{status}</p>}
    </div>
  );
}
