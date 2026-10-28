import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Compass, Code2, FileUp, GraduationCap, HomeIcon, MapPinned, UserRound, Bell, Search, Sparkles, Users, BookOpen } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api, roleLabel } from "../../api/client";
import type { Asset, College, Course, CourseProgress, ProgressSummary, View } from "../../types";
import { starterCourses } from "../../data/constants";
import HomePage from "../../pages/HomePage";
import CatalogPage from "../../pages/CatalogPage";
import CoursePage from "../../pages/CoursePage";
import PracticePage from "../../pages/PracticePage";
import ProfilePage from "../../pages/ProfilePage";
import AdminPage from "../../pages/AdminPage";
import TeacherStudio from "../../pages/teacher/TeacherStudio";
import TeacherDashboard from "../../pages/teacher/TeacherDashboard";
import TeacherCourses from "../../pages/teacher/TeacherCourses";
import WeeklyGoalCard from "../WeeklyGoalCard";

export default function AppLayout() {
  const { user, logout } = useAuth();
  // Super admin sees every college; a college admin sees only their own. Both
  // use the administration workspace, so most checks treat them together.
  const isSuperAdmin = user?.role === "admin";
  const isAdminLike = isSuperAdmin || user?.role === "collegeAdmin";
  const [view, setView] = useState<View>(
    isAdminLike ? "admin" : user?.role === "teacher" ? "teacher" : "home"
  );
  // Students start empty so the bundled demo catalog never leaks into a real
  // college portal before the server-scoped list arrives; staff keep the demo
  // catalog as a fallback for an empty platform.
  const [courses, setCourses] = useState<Course[]>(user?.role === "student" ? [] : starterCourses);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [progress, setProgress] = useState<CourseProgress[]>([]);
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [search, setSearch] = useState("");
  const [courseId, setCourseId] = useState("python");
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // In-app back stack. Every navigation pushes the page we are leaving (view +
  // the course it was showing), so the back button steps one page back for
  // admin, teacher and student alike — including back into a specific course.
  const [history, setHistory] = useState<{ view: View; courseId: string }[]>([]);

  const assignedCollege = colleges.find((college) => college._id === user?.collegeId);
  const assignedDepartment = assignedCollege?.departments.find(
    (d) => d._id === user?.departmentId || d.name.toLowerCase() === user?.department?.toLowerCase()
  );

  // Real, server-tracked progress folded onto each course so every existing
  // `course.progress` reader (catalog, home, cards) shows true completion.
  const progressBySlug = useMemo(() => new Map(progress.map((entry) => [entry.courseId, entry])), [progress]);
  const decoratedCourses = useMemo(
    () => courses.map((course) => ({ ...course, progress: progressBySlug.get(course.slug)?.percent ?? course.progress ?? 0 })),
    [courses, progressBySlug]
  );

  // The server already scopes a student's courses to their department's grants
  // plus their department's faculty uploads, so the portal trusts that list and
  // only guards on an active college/department.
  const availableCourses =
    user?.role === "student"
      ? assignedCollege?.active && assignedDepartment?.active
        ? decoratedCourses
        : []
      : decoratedCourses;

  const selectedCourse = availableCourses.find((c) => c.slug === courseId) ?? availableCourses[0] ?? courses[0];

  const loadProgress = useCallback(
    () =>
      api
        .getProgress()
        .then((result) => {
          setProgress(result.progress);
          setSummary(result.summary);
        })
        .catch(() => {}),
    []
  );

  useEffect(() => {
    const isStudent = user?.role === "student";
    Promise.all([api.listCourses(), api.listAssets(), api.listColleges(), api.getProgress()])
      .then(([courseResult, assetResult, collegeResult, progressResult]) => {
        // Students take the server-scoped list verbatim (even when empty) so the
        // demo catalog cannot stand in for courses they were never granted.
        if (!isStudent || courseResult.courses.length) setCourses(courseResult.courses);
        setAssets(assetResult.assets);
        setColleges(collegeResult.colleges);
        setProgress(progressResult.progress);
        setSummary(progressResult.summary);
      })
      .catch(() => {
        setAssets([]);
        setColleges([]);
      });
  }, [user?.role]);

  const navItems: { id: View; label: string; mark: React.ReactNode }[] =
    isAdminLike
      ? [
          { id: "admin", label: isSuperAdmin ? "Dashboard" : "College dashboard", mark: <HomeIcon size={18} strokeWidth={1.9} /> },
          { id: "profile", label: isSuperAdmin ? "Admin profile" : "College profile", mark: <UserRound size={18} strokeWidth={1.9} /> },
        ]
      : user?.role === "teacher"
      ? [
          { id: "teacher", label: "My dashboard", mark: <GraduationCap size={18} strokeWidth={1.9} /> },
          { id: "teacherCourses", label: "My courses", mark: <BookOpen size={18} strokeWidth={1.9} /> },
          { id: "admin", label: "Content studio", mark: <FileUp size={18} strokeWidth={1.9} /> },
          { id: "profile", label: "My profile", mark: <UserRound size={18} strokeWidth={1.9} /> },
        ]
      : [
          { id: "home", label: "My learning", mark: <HomeIcon size={18} strokeWidth={1.9} /> },
          { id: "catalog", label: "Explore courses", mark: <Compass size={18} strokeWidth={1.9} /> },
          { id: "practice", label: "Code lab", mark: <Code2 size={18} strokeWidth={1.9} /> },
          { id: "profile", label: "My profile", mark: <UserRound size={18} strokeWidth={1.9} /> },
        ];

  /** Navigate forward, remembering the page we are leaving. Same-page clicks are ignored. */
  function navigate(next: View) {
    if (next === view) return;
    setHistory((h) => [...h, { view, courseId }]);
    setView(next);
  }

  function openCourse(id: string) {
    if (user?.role === "student" && id && !availableCourses.some((c) => c.slug === id)) {
      navigate("catalog");
      return;
    }
    if (view === "course" && id === courseId) return;
    setHistory((h) => [...h, { view, courseId }]);
    setCourseId(id);
    setView("course");
  }

  /** Step one page back; if there is nothing behind us, fall back to the role's home. */
  function goBack() {
    if (!history.length) {
      // If no history, go to role-appropriate home/dashboard
      if (user?.role === "teacher") {
        setView("teacher");
      } else if (isAdminLike) {
        setView("admin");
      } else {
        setView("home");
      }
      return;
    }
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    const courseGone = prev.view === "course" && !availableCourses.some((c) => c.slug === prev.courseId);
    if (courseGone) {
      setView(user?.role === "teacher" ? "teacher" : isAdminLike ? "admin" : "catalog");
      return;
    }
    setCourseId(prev.courseId);
    setView(prev.view);
  }

  const canGoBack = history.length > 0;

  /** Leaving the profile returns to where the user came from, or their home page. */
  function leaveProfile() {
    if (history.length) {
      goBack();
      return;
    }
    setView(user?.role === "teacher" ? "teacher" : isAdminLike ? "admin" : "home");
  }

  if (!user) return null;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate(isAdminLike ? "admin" : user.role === "teacher" ? "teacher" : "home")} aria-label="Taras Learn home">
          <span className="brand-mark"><GraduationCap size={18} /></span>
          <span>Taras<span className="brand-light">Learn</span></span>
        </button>
        <span className="nav-section-label">Workspace</span>
        <nav className={isAdminLike ? "admin-nav" : ""} aria-label="Primary navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id || (view === "course" && item.id === "home") ? "active" : ""}`}
              onClick={() => navigate(item.id)}
            >
              <span className="nav-mark">{item.mark}</span>
              {item.label}
            </button>
          ))}
        </nav>
        {isAdminLike ? (
          <div className="sidebar-card admin-sidebar-card">
            <span className="eyebrow">{isSuperAdmin ? "Platform status" : "College status"}</span>
            <div className="goal-row"><strong>Operational</strong><span>Live</span></div>
            <p>{courses.length} courses · {assets.length} resources</p>
          </div>
        ) : user.role === "student" ? (
          <WeeklyGoalCard />
        ) : null}
        <button className="profile-chip" onClick={() => navigate("profile")}>
          <span>{user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}</span>
          <div><strong>{user.name}</strong><small>{roleLabel(user.role)}</small></div>
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button
            className="back-button"
            type="button"
            onClick={goBack}
            disabled={!canGoBack}
            aria-label="Go back"
            title={canGoBack ? "Back" : "Nothing to go back to"}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="mobile-brand"><span className="brand-mark"><GraduationCap size={16} /></span><strong>TarasLearn</strong></div>
          <div className="global-search">
            <Search size={17} />
            <input
              aria-label={isAdminLike ? "Search administration" : "Search courses"}
              placeholder={isAdminLike ? "Search students, courses, and content…" : "Search courses, lessons, and skills…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => { if (user.role === "student") navigate("catalog"); }}
            />
            <kbd>⌘ K</kbd>
          </div>
          <div className="top-actions">
            <div className="notification-wrapper">
              <button className="notification-button" aria-label="Notifications" onClick={() => setNotificationsOpen(!notificationsOpen)}>
                <Bell size={17} />
                <i />
              </button>
              {notificationsOpen && (
                <div className="notifications-panel">
                  <h3>Notifications</h3>
                  <p>No new notifications.</p>
                  <button className="text-button" type="button" onClick={() => setNotificationsOpen(false)}>Close</button>
                </div>
              )}
            </div>
            {user.role === "teacher" && view !== "teacherCourses" && (
              <button className="primary-small create-top-button" onClick={() => navigate("teacherCourses")}><span>＋</span>Create course</button>
            )}
            <button className="top-profile-button" onClick={() => navigate("profile")} aria-label={`Open ${user.name} profile`}>
              <b>{user.name.slice(0, 1).toUpperCase()}</b>
              <span><strong>{user.name.split(" ")[0]}</strong><small>{user.role}</small></span>
            </button>
            <button className="signout-button" onClick={logout}>Sign out</button>
          </div>
        </header>

        {view === "home" && <HomePage onOpenCourse={openCourse} availableCourses={availableCourses} summary={summary} />}
        {view === "catalog" && <CatalogPage search={search} openCourse={openCourse} availableCourses={availableCourses} />}
        {view === "course" && (
          <CoursePage
            key={courseId}
            course={selectedCourse}
            assets={assets}
            onOpenPractice={() => navigate("practice")}
            progress={progressBySlug.get(selectedCourse?.slug ?? "")}
            onRefreshProgress={loadProgress}
          />
        )}
        {view === "practice" && <PracticePage />}
        {view === "profile" && <ProfilePage onSaved={leaveProfile} />}
        {view === "teacher" && user.role === "teacher" && (
          <TeacherDashboard goTo={navigate} openCourse={openCourse} />
        )}
        {view === "teacherCourses" && user.role === "teacher" && (
          <TeacherCourses setCourses={setCourses} assets={assets} setAssets={setAssets} openCourse={openCourse} goTo={navigate} />
        )}
        {view === "admin" &&
          (user.role === "teacher" ? (
            <TeacherStudio courses={courses} assets={assets} setAssets={setAssets} goTo={navigate} search={search} />
          ) : (
            <AdminPage
              courses={courses}
              setCourses={setCourses}
              assets={assets}
              setAssets={setAssets}
              colleges={colleges}
              setColleges={setColleges}
              search={search}
            />
          ))}
      </section>
    </main>
  );
}
