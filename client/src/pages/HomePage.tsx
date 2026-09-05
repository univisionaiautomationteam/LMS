import { BookOpen, ChevronRight, Clock3, Flame, Play, Sparkles, Trophy } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import type { Course } from "../types";

export default function HomePage({ onOpenCourse, availableCourses }: { onOpenCourse: (id: string) => void; availableCourses: Course[] }) {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="page-content home-page">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="hero-welcome"><Sparkles size={14} /> Your learning workspace</span>
          <h1>Welcome back, {user.name.split(" ")[0]}.</h1>
          <p>Build career-ready engineering skills through focused lessons, hands-on practice, and measurable progress.</p>
          <div className="hero-actions">
            <button className="primary-button light" onClick={() => onOpenCourse("python")}><Play size={15} fill="currentColor" /> Resume learning</button>
            <button className="hero-secondary" onClick={() => onOpenCourse("")}>Explore courses <ChevronRight size={15} /></button>
          </div>
          <div className="hero-meta"><span><Clock3 size={13} /> 32 min learned this week</span><span><Flame size={13} /> 7-day streak</span></div>
        </div>
        <div className="hero-stat"><div className="ring"><span>68%</span></div><strong>Python pathway</strong><small>29 of 42 lessons</small></div>
      </section>

      <section className="learning-kpis" aria-label="Learning overview">
        <article><span className="kpi-icon green"><BookOpen size={18} /></span><div><strong>{availableCourses.filter((c) => c.progress).length}</strong><small>Courses in progress</small></div><em>View learning</em></article>
        <article><span className="kpi-icon orange"><Clock3 size={18} /></span><div><strong>18.5h</strong><small>Total learning time</small></div><em>+3.2h this week</em></article>
        <article><span className="kpi-icon violet"><Trophy size={18} /></span><div><strong>12</strong><small>Lessons completed</small></div><em>Top 18% of learners</em></article>
        <article><span className="kpi-icon blue"><Flame size={18} /></span><div><strong>7</strong><small>Day streak</small></div><em>Keep it going</em></article>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div><span className="eyebrow">In progress</span><h2>Pick up where you left off</h2></div>
          <button className="text-button" onClick={() => onOpenCourse("")}>View all →</button>
        </div>
        <div className="continue-grid">
          {availableCourses.filter((c) => c.progress).map((course) => (
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
      </section>

      <section className="dashboard-grid enhanced-dashboard">
        <div className="section-block compact">
          <div className="section-heading"><div><span className="eyebrow">Recommended</span><h2>Build your next skill</h2></div></div>
          <div className="mini-course-list">
            {availableCourses.slice(2, 6).map((course) => (
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
            <h2>7 days strong</h2>
            <p>One lesson today keeps your momentum alive.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
