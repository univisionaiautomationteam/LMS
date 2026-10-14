import { BookOpen, ChevronRight, Clock3, Flame, Play, Sparkles, Trophy } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import type { Course, ProgressSummary } from "../types";

/** Consecutive study days ending today (or yesterday, so a streak survives the morning). */
function computeStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const days = new Set(dates);
  const cursor = new Date();
  const key = (d: Date) => d.toISOString().slice(0, 10);
  if (!days.has(key(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!days.has(key(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(key(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export default function HomePage({
  onOpenCourse,
  availableCourses,
  summary,
}: {
  onOpenCourse: (id: string) => void;
  availableCourses: Course[];
  summary: ProgressSummary | null;
}) {
  const { user } = useAuth();
  if (!user) return null;

  const inProgress = availableCourses.filter((c) => (c.progress ?? 0) > 0);
  const lessonsCompleted = summary?.lessonsCompleted ?? 0;
  const quizzesPassed = summary?.quizzesPassed ?? 0;
  const averageScore = summary?.averageScore ?? 0;
  const streak = computeStreak(summary?.activityDates ?? []);
  const firstName = user.name.split(" ")[0];
  const topCourse = inProgress.length ? inProgress[0] : availableCourses[0];

  return (
    <div className="page-content home-page">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="hero-welcome"><Sparkles size={14} /> Your learning workspace</span>
          <h1>Welcome back, {firstName}.</h1>
          <p>Build career-ready engineering skills through focused lessons, hands-on practice, and measurable progress.</p>
          <div className="hero-actions">
            <button className="primary-button light" onClick={() => onOpenCourse(topCourse?.slug ?? "")}><Play size={15} fill="currentColor" /> {inProgress.length ? "Resume learning" : "Start learning"}</button>
            <button className="hero-secondary" onClick={() => onOpenCourse("")}>Explore courses <ChevronRight size={15} /></button>
          </div>
          <div className="hero-meta">
            <span><Clock3 size={13} /> {lessonsCompleted} lesson{lessonsCompleted === 1 ? "" : "s"} completed</span>
            <span><Flame size={13} /> {streak}-day streak</span>
          </div>
        </div>
        <div className="hero-stat">
          <div className="ring"><span>{topCourse ? topCourse.progress ?? 0 : 0}%</span></div>
          <strong>{topCourse ? topCourse.title : "No courses yet"}</strong>
          <small>{topCourse ? `${inProgress.length} course${inProgress.length === 1 ? "" : "s"} in progress` : "Assigned courses will appear here"}</small>
        </div>
      </section>

      <section className="learning-kpis" aria-label="Learning overview">
        <article><span className="kpi-icon green"><BookOpen size={18} /></span><div><strong>{inProgress.length}</strong><small>Courses in progress</small></div><em>View learning</em></article>
        <article><span className="kpi-icon orange"><Clock3 size={18} /></span><div><strong>{lessonsCompleted}</strong><small>Lessons completed</small></div><em>{quizzesPassed} quiz{quizzesPassed === 1 ? "" : "zes"} passed</em></article>
        <article><span className="kpi-icon violet"><Trophy size={18} /></span><div><strong>{averageScore}%</strong><small>Average quiz score</small></div><em>{quizzesPassed ? "Keep it up" : "Take a quiz"}</em></article>
        <article><span className="kpi-icon blue"><Flame size={18} /></span><div><strong>{streak}</strong><small>Day streak</small></div><em>{streak ? "Keep it going" : "Start today"}</em></article>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div><span className="eyebrow">In progress</span><h2>Pick up where you left off</h2></div>
          <button className="text-button" onClick={() => onOpenCourse("")}>View all →</button>
        </div>
        {inProgress.length ? (
          <div className="continue-grid">
            {inProgress.map((course) => (
              <button className="continue-card" key={course.slug} onClick={() => onOpenCourse(course.slug)}>
                <div className="course-art" style={{ background: course.color }}><span>{course.icon}</span><small>{course.language}</small></div>
                <div className="continue-body">
                  <span className="pill">{course.level}</span>
                  <h3>{course.title}</h3>
                  <div className="progress-track thin"><span style={{ width: `${course.progress}%` }} /></div>
                  <div className="card-meta"><span>{course.progress}% complete</span><strong>Continue →</strong></div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="course-access-empty"><BookOpen size={26} /><h2>No courses in progress yet</h2><p>Open a course from the catalog and start your first lesson to see it here.</p></div>
        )}
      </section>

      <section className="dashboard-grid enhanced-dashboard">
        <div className="section-block compact">
          <div className="section-heading"><div><span className="eyebrow">Recommended</span><h2>Build your next skill</h2></div></div>
          <div className="mini-course-list">
            {availableCourses.slice(0, 4).map((course) => (
              <button key={course.slug} onClick={() => onOpenCourse(course.slug)}>
                <span className="mini-icon" style={{ background: course.color }}>{course.icon}</span>
                <span><strong>{course.title}</strong><small>{course.level} · {course.duration}</small></span>
                <b>→</b>
              </button>
            ))}
          </div>
        </div>
        <div className="dashboard-side">
          <div className="streak-card">
            <span className="streak-icon"><Flame size={19} /></span>
            <span className="eyebrow">Learning streak</span>
            <h2>{streak ? `${streak} day${streak === 1 ? "" : "s"} strong` : "Start your streak"}</h2>
            <p>{streak ? "One lesson today keeps your momentum alive." : "Complete a lesson today to begin your streak."}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
