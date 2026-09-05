import { useEffect, useState } from "react";
import { Compass, Code2, GraduationCap, HomeIcon, MapPinned, UserRound, Bell, Search, Sparkles, Users, BookOpen } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api, roleLabel } from "../../api/client";
import type { Asset, College, Course, View } from "../../types";
import { starterCourses } from "../../data/constants";
import HomePage from "../../pages/HomePage";
import CatalogPage from "../../pages/CatalogPage";
import CoursePage from "../../pages/CoursePage";
import PracticePage from "../../pages/PracticePage";
import ProfilePage from "../../pages/ProfilePage";
import AdminPage from "../../pages/AdminPage";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<View>(user?.role === "admin" ? "admin" : "home");
  const [courses, setCourses] = useState<Course[]>(starterCourses);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [search, setSearch] = useState("");
  const [courseId, setCourseId] = useState("python");

  const assignedCollege = colleges.find((college) => college._id === user?.collegeId);
  const assignedDepartment = assignedCollege?.departments.find(
    (d) => d._id === user?.departmentId || d.name.toLowerCase() === user?.department?.toLowerCase()
  );

  const availableCourses =
    user?.role === "student"
      ? courses.filter((c) => assignedCollege?.active && assignedDepartment?.active && assignedDepartment.allowedCourseIds.includes(c.slug))
      : courses;

  const selectedCourse = availableCourses.find((c) => c.slug === courseId) ?? availableCourses[0] ?? courses[0];

  useEffect(() => {
    Promise.all([api.listCourses(), api.listAssets(), api.listColleges()])
      .then(([courseResult, assetResult, collegeResult]) => {
        if (courseResult.courses.length) setCourses(courseResult.courses);
        setAssets(assetResult.assets);
        setColleges(collegeResult.colleges);
      })
      .catch(() => {
        setAssets([]);
        setColleges([]);
      });
  }, []);

  const navItems: { id: View; label: string; mark: React.ReactNode }[] =
    user?.role === "admin"
      ? [
          { id: "admin", label: "Dashboard", mark: <HomeIcon size={18} strokeWidth={1.9} /> },
          { id: "profile", label: "Admin profile", mark: <UserRound size={18} strokeWidth={1.9} /> },
        ]
      : [
          { id: "home", label: "My learning", mark: <HomeIcon size={18} strokeWidth={1.9} /> },
          { id: "catalog", label: "Explore courses", mark: <Compass size={18} strokeWidth={1.9} /> },
          { id: "practice", label: "Code lab", mark: <Code2 size={18} strokeWidth={1.9} /> },
          { id: "profile", label: "My profile", mark: <UserRound size={18} strokeWidth={1.9} /> },
          ...(user?.role === "teacher"
            ? [{ id: "admin" as View, label: "Instructor studio", mark: <GraduationCap size={18} strokeWidth={1.9} /> }]
            : []),
        ];

  function openCourse(id: string) {
    if (user?.role === "student" && id && !availableCourses.some((c) => c.slug === id)) {
      setView("catalog");
      return;
    }
    setCourseId(id);
    setView("course");
  }

  if (!user) return null;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setView(user.role === "admin" ? "admin" : "home")} aria-label="Taras Learn home">
          <span className="brand-mark"><GraduationCap size={18} /></span>
          <span>Taras<span className="brand-light">Learn</span></span>
        </button>
        <span className="nav-section-label">Workspace</span>
        <nav className={user.role === "admin" ? "admin-nav" : ""} aria-label="Primary navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id || (view === "course" && item.id === "home") ? "active" : ""}`}
              onClick={() => setView(item.id)}
            >
              <span className="nav-mark">{item.mark}</span>
              {item.label}
            </button>
          ))}
        </nav>
        {user.role === "admin" ? (
          <div className="sidebar-card admin-sidebar-card">
            <span className="eyebrow">Platform status</span>
            <div className="goal-row"><strong>Operational</strong><span>Live</span></div>
            <p>{courses.length} courses · {assets.length} resources</p>
          </div>
        ) : (
          <div className="sidebar-card">
            <span className="eyebrow">Weekly goal</span>
            <div className="goal-row"><strong>3h 20m</strong><span>of 5h</span></div>
            <div className="progress-track"><span style={{ width: "67%" }} /></div>
            <p>Two focused sessions left. You've got this.</p>
          </div>
        )}
        <button className="profile-chip" onClick={() => setView("profile")}>
          <span>{user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}</span>
          <div><strong>{user.name}</strong><small>{roleLabel(user.role)}</small></div>
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><GraduationCap size={16} /></span><strong>TarasLearn</strong></div>
          <div className="global-search">
            <Search size={17} />
            <input
              aria-label={user.role === "admin" ? "Search administration" : "Search courses"}
              placeholder={user.role === "admin" ? "Search students, courses, and content…" : "Search courses, lessons, and skills…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => { if (user.role !== "admin") setView("catalog"); }}
            />
            <kbd>⌘ K</kbd>
          </div>
          <div className="top-actions">
            <button className="notification-button" aria-label="Notifications"><Bell size={17} /><i /></button>
            {user.role === "admin" && (
              <button className="primary-small create-top-button" onClick={() => setView("admin")}><span>＋</span>Create course</button>
            )}
            <button className="top-profile-button" onClick={() => setView("profile")} aria-label={`Open ${user.name} profile`}>
              <b>{user.name.slice(0, 1).toUpperCase()}</b>
              <span><strong>{user.name.split(" ")[0]}</strong><small>{user.role}</small></span>
            </button>
            <button className="signout-button" onClick={logout}>Sign out</button>
          </div>
        </header>

        {view === "home" && <HomePage onOpenCourse={openCourse} availableCourses={availableCourses} />}
        {view === "catalog" && <CatalogPage search={search} openCourse={openCourse} availableCourses={availableCourses} />}
        {view === "course" && (
          <CoursePage key={courseId} course={selectedCourse} assets={assets} onOpenPractice={() => setView("practice")} />
        )}
        {view === "practice" && <PracticePage />}
        {view === "profile" && <ProfilePage onSaved={() => setView("home")} />}
        {view === "admin" && (
          <AdminPage
            courses={courses}
            setCourses={setCourses}
            assets={assets}
            setAssets={setAssets}
            colleges={colleges}
            setColleges={setColleges}
          />
        )}
      </section>
    </main>
  );
}
