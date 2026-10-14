import { BookOpen, FileUp, GraduationCap, PencilLine, Plus, UserRound } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTeacherStats } from "../../hooks/useTeacherStats";
import { formatBytes } from "../../data/constants";
import type { View } from "../../types";

/**
 * Teacher home base: their own numbers only (created/updated courses, lessons,
 * uploads), plus links into the rest of the portal. Every figure comes from
 * /api/teacher/stats, which aggregates server-side by the caller's email.
 */
export default function TeacherDashboard({
  goTo,
  openCourse,
}: {
  goTo: (view: View) => void;
  openCourse: (slug: string) => void;
}) {
  const { user } = useAuth();
  const { stats, loading, error, reload } = useTeacherStats();

  if (!user) return null;
  const firstName = user.name.split(" ")[0];

  return (
    <div className="page-content admin-page">
      <section className="page-intro split admin-hero">
        <div>
          <span className="eyebrow accent">Teacher dashboard</span>
          <h1>Welcome back, {firstName}.</h1>
          <p>
            {stats
              ? `You have created ${stats.coursesCreated} ${stats.coursesCreated === 1 ? "course" : "courses"} and published ${stats.assetsUploaded} resources so far.`
              : "Here is everything you have built on TarasLearn, in one place."}
          </p>
        </div>
        <div className="hero-actions">
          <button className="primary-small" type="button" onClick={() => goTo("teacherCourses")}>
            <Plus size={15} /> Create course
          </button>
          <button className="outline-small" type="button" onClick={() => goTo("profile")}>
            <UserRound size={15} /> Edit profile
          </button>
        </div>
      </section>

      {error && (
        <p className="admin-status" role="alert">
          {error} <button className="text-button" type="button" onClick={reload}>Retry</button>
        </p>
      )}

      <section className="admin-kpis">
        <article>
          <span className="kpi-icon violet"><GraduationCap size={19} /></span>
          <div>
            <strong>{loading ? "…" : stats?.coursesCreated ?? 0}</strong>
            <small>Courses created</small>
          </div>
          <em>By you</em>
        </article>
        <article>
          <span className="kpi-icon blue"><PencilLine size={19} /></span>
          <div>
            <strong>{loading ? "…" : stats?.coursesUpdated ?? 0}</strong>
            <small>Courses updated</small>
          </div>
          <em>Content revised</em>
        </article>
        <article>
          <span className="kpi-icon green"><BookOpen size={19} /></span>
          <div>
            <strong>{loading ? "…" : stats?.lessonsTotal ?? 0}</strong>
            <small>Lessons authored</small>
          </div>
          <em>{loading ? "" : `of ${stats?.coursesTotal ?? 0} in catalog`}</em>
        </article>
        <article>
          <span className="kpi-icon orange"><FileUp size={19} /></span>
          <div>
            <strong>{loading ? "…" : formatBytes(stats?.storageBytes ?? 0)}</strong>
            <small>Storage used</small>
          </div>
          <em>{loading ? "" : `${stats?.assetsUploaded ?? 0} uploads`}</em>
        </article>
      </section>

      {stats && !stats.profileComplete && (
        <section className="admin-status" role="status">
          Your profile is incomplete — add your designation and qualification so learners can see your credentials.{" "}
          <button className="text-button" type="button" onClick={() => goTo("profile")}>
            Complete profile →
          </button>
        </section>
      )}

      <div className="admin-grid">
        <section className="management-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Your recent courses</span>
              <h2>Updated most recently</h2>
            </div>
            <button className="text-button" type="button" onClick={() => goTo("teacherCourses")}>
              Manage all →
            </button>
          </div>
          <div className="management-list">
            {loading && <div className="empty-state">Loading your courses…</div>}
            {!loading && stats && stats.recentCourses.length === 0 && (
              <div className="empty-state">
                You have not created a course yet.{" "}
                <button className="text-button" type="button" onClick={() => goTo("teacherCourses")}>
                  Create your first course →
                </button>
              </div>
            )}
            {!loading &&
              stats?.recentCourses.map((course) => (
                <div className="management-item" key={course.slug}>
                  <span className="mini-icon" style={{ background: course.color }}>
                    {course.icon}
                  </span>
                  <span>
                    <strong>{course.title}</strong>
                    <small>
                      {course.lessons} lessons · updated {new Date(course.updatedAt).toLocaleDateString()}
                    </small>
                  </span>
                  <div className="management-actions">
                    <button className="text-button" type="button" onClick={() => openCourse(course.slug)}>
                      Open
                    </button>
                    <button className="text-button" type="button" onClick={() => goTo("teacherCourses")}>
                      Edit
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </section>

        <section className="publish-checklist">
          <span className="eyebrow">This week</span>
          <h2>Your teaching snapshot.</h2>
          {[
            ["01", "Courses created", `${stats?.coursesCreated ?? 0} of ${stats?.coursesTotal ?? 0} catalog courses are yours.`],
            ["02", "Courses updated", `${stats?.coursesUpdated ?? 0} of your courses have revised content.`],
            ["03", "Content published", `${stats?.assetsUploaded ?? 0} uploads across ${stats?.coursesCovered ?? 0} courses.`],
            ["04", "Weekly goal", "Track your target from the sidebar and adjust it any time."],
          ].map(([num, title, body]) => (
            <div key={num}>
              <span>{num}</span>
              <p>
                <strong>{title}</strong>
                <small>{body}</small>
              </p>
            </div>
          ))}
          <p className="snapshot-note">
            Only your own courses and content are counted here — other instructors' work never appears in your portal.
          </p>
        </section>
      </div>

      <section className="library-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Jump back in</span>
            <h2>Keep going</h2>
          </div>
        </div>
        <div className="teacher-shortcuts">
          <button type="button" onClick={() => goTo("teacherCourses")}>
            <GraduationCap size={18} />
            <strong>My courses</strong>
            <small>Create, edit, and delete courses you own.</small>
          </button>
          <button type="button" onClick={() => goTo("admin")}>
            <FileUp size={18} />
            <strong>Content studio</strong>
            <small>Upload videos and documents for your courses.</small>
          </button>
        </div>
      </section>
    </div>
  );
}
