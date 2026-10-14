import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { BookOpen, Building2, GraduationCap, Layers, Library, MapPinned, Users } from "lucide-react";
import { api, courseAuthorLabel } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Asset, AuthUser, College, Course } from "../types";
import { INDIA_STATES } from "../data/constants";
import AdminStudentMap from "../components/AdminStudentMap";
import AssetUploader from "../components/AssetUploader";
import AssetTable from "../components/AssetTable";
import CourseFields, { readCourseForm } from "../components/CourseFields";
import CurriculumBuilder from "../components/CurriculumBuilder";
import SidePanel from "../components/SidePanel";

type BulkRow = {
  row: number;
  name: string;
  email: string;
  role: string;
  password: string;
  studentId: string;
  department: string;
  collegeId: string;
  valid: boolean;
  issue: string;
};

type AdminView = "overview" | "colleges" | "departments" | "content" | "people" | "geography";

export default function AdminPage({
  courses,
  setCourses,
  assets,
  setAssets,
  colleges,
  setColleges,
}: {
  courses: Course[];
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  assets: Asset[];
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
  colleges: College[];
  setColleges: React.Dispatch<React.SetStateAction<College[]>>;
}) {
  const { user } = useAuth();
  const [adminView, setAdminView] = useState<AdminView>("overview");
  const [status, setStatus] = useState("");
  const [collegeStatus, setCollegeStatus] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [curriculumCourseId, setCurriculumCourseId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userCollegeId, setUserCollegeId] = useState(user?.collegeId ?? "");
  const [defaultPassword, setDefaultPassword] = useState("");
  const [domainsDraft, setDomainsDraft] = useState("");
  const [domainsStatus, setDomainsStatus] = useState("");
  const [showCollegeForm, setShowCollegeForm] = useState(false);
  const [structureCollegeId, setStructureCollegeId] = useState<string | null>(null);
  const [pushTargets, setPushTargets] = useState<Record<string, boolean>>({});

  // Super admin runs the whole platform (creates colleges, courses, assets);
  // a college admin runs only their own college (people, departments, access).
  const isAdmin = user?.role === "admin";
  const isCollegeAdmin = user?.role === "collegeAdmin";
  const isStaff = isAdmin || isCollegeAdmin;

  useEffect(() => {
    api
      .listUsers()
      .then(({ users }) => setUsers(users))
      .catch(() => {});
  }, []);

  const selectedCollege = colleges.find((c) => c._id === selectedCollegeId) ?? colleges[0];
  const selectedDepartment = selectedCollege?.departments.find((d) => d._id === selectedDepartmentId) ?? selectedCollege?.departments[0];
  const directoryUsers = users.filter((u) => u.role !== "admin");
  const locatedStudents = directoryUsers.filter((u) => u.role === "student" && u.profile?.complete && u.profile.state);
  const structureCollege = colleges.find((c) => c._id === structureCollegeId) ?? null;
  const students = directoryUsers.filter((u) => u.role === "student");
  const teachers = directoryUsers.filter((u) => u.role === "teacher");
  const totalDepartments = colleges.reduce((n, c) => n + c.departments.length, 0);
  // Super admin manages the whole catalog; a college admin only the courses their
  // own teachers created (assets in those courses are what they can edit).
  const contentCourses = isAdmin
    ? courses
    : courses.filter((c) => {
        const owner = users.find((u) => u.email === c.createdBy);
        return owner && String(owner.collegeId ?? "") === String(user?.collegeId ?? "");
      });

  useEffect(() => {
    setDomainsDraft((selectedCollege?.domains ?? []).join(", "));
    setDomainsStatus("");
  }, [selectedCollege?._id, selectedCollege?.domains?.join(",")]);

  if (!user) return null;

  async function createCourse(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const values = readCourseForm(new FormData(formEl));
    if (!values.title) {
      setStatus("Course title is required.");
      return;
    }
    setStatus("Creating course…");
    try {
      const { course } = await api.createCourse(values);
      setCourses((cur) => [course, ...cur]);
      // Super admin can grant the new course to chosen departments in the same step.
      const targetDeptIds = Object.entries(pushTargets).filter(([, on]) => on).map(([id]) => id);
      let pushed = 0;
      for (const college of colleges) {
        for (const dept of college.departments.filter((d) => targetDeptIds.includes(d._id))) {
          const next = Array.from(new Set([...(dept.allowedCourseIds ?? []), course.slug]));
          try {
            const { college: updated } = await api.updateDepartmentAccess(college._id, dept._id, { allowedCourseIds: next, active: true });
            setColleges((cur) => cur.map((c) => (c._id === updated._id ? updated : c)));
            pushed += 1;
          } catch {
            // Keep pushing to the remaining departments if one fails.
          }
        }
      }
      setStatus(pushed ? `Course “${course.title}” is live and pushed to ${pushed} department(s).` : `Course “${course.title}” is live.`);
      formEl.reset();
      setPushTargets({});
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Course creation failed.");
    }
  }

  async function createUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setStatus("Creating login…");
    try {
      const role = String(form.get("role") ?? "student");
      const collegeId = String(form.get("collegeId") ?? "");
      const departmentId = String(form.get("departmentId") ?? "");
      const department = colleges
        .find((c) => c._id === collegeId)
        ?.departments.find((d) => d._id === departmentId)?.name ?? "";
      if (role === "student" && !collegeId) throw new Error("Select a college for this student account.");
      if ((role === "student" || role === "teacher") && !departmentId) {
        throw new Error(`Select a department for this ${role} account.`);
      }
      if (role === "collegeAdmin" && !collegeId) {
        throw new Error("Select a college for this college admin account.");
      }
      const { user: created } = await api.createUser({
        name: form.get("name"),
        email: form.get("email"),
        role,
        temporaryPassword: form.get("password"),
        collegeId,
        departmentId,
        department,
      });
      setUsers((cur) => [created, ...cur]);
      setStatus(`Login created for ${created.name} (${created.email}).`);
      formEl.reset();
      setUserCollegeId("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Account creation failed.");
    }
  }

  async function createCollege(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setCollegeStatus("Creating college…");
    try {
      const { college, admin } = await api.createCollege({
        name: form.get("name"),
        code: form.get("code"),
        state: form.get("state"),
        domains: form.get("domains"),
        adminName: form.get("adminName"),
        adminEmail: form.get("adminEmail"),
        adminPassword: form.get("adminPassword"),
      });
      setColleges((cur) => [college, ...cur]);
      if (admin) setUsers((cur) => [admin, ...cur]);
      setSelectedCollegeId(college._id);
      setDomainsDraft((college.domains ?? []).join(", "));
      setCollegeStatus(
        admin
          ? `${college.name} created with college admin ${admin.email}. Now add its first department.`
          : `${college.name} created. Now add its first department.`
      );
      formEl.reset();
      setShowCollegeForm(false);
    } catch (err) {
      setCollegeStatus(err instanceof Error ? err.message : "Unable to create college.");
    }
  }

  async function createDepartment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedCollege) return;
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setCollegeStatus("Creating department…");
    try {
      const { college } = await api.createCollegeDepartment(selectedCollege._id, {
        name: form.get("departmentName"),
        code: form.get("departmentCode"),
      });
      setColleges((cur) => cur.map((c) => (c._id === college._id ? college : c)));
      const created = college.departments.find((d: { code: string }) => d.code === String(form.get("departmentCode")).toUpperCase());
      setSelectedDepartmentId(created?._id ?? "");
      setCollegeStatus(`${form.get("departmentName")} created. Assign its courses.`);
      formEl.reset();
    } catch (err) {
      setCollegeStatus(err instanceof Error ? err.message : "Unable to create department.");
    }
  }

  async function saveCollegeAccess(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedCollege || !selectedDepartment) return;
    const form = new FormData(e.currentTarget);
    const allowedCourseIds = form.getAll("courseIds").map(String);
    setCollegeStatus("Saving course access…");
    try {
      const { college } = await api.updateDepartmentAccess(selectedCollege._id, selectedDepartment._id, {
        allowedCourseIds,
        active: form.get("active") === "on",
      });
      setColleges((cur) => cur.map((c) => (c._id === college._id ? college : c)));
      setCollegeStatus(`${selectedDepartment.name} students can access ${allowedCourseIds.length} courses.`);
    } catch (err) {
      setCollegeStatus(err instanceof Error ? err.message : "Unable to save college access.");
    }
  }

  async function saveCollegeDomains(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedCollege) return;
    setDomainsStatus("Saving email domains…");
    try {
      const { college } = await api.updateCollege(selectedCollege._id, { domains: domainsDraft });
      setColleges((cur) => cur.map((c) => (c._id === college._id ? college : c)));
      setDomainsDraft((college.domains ?? []).join(", "));
      setDomainsStatus(college.domains.length ? `Saved ${college.domains.length} domain(s).` : "Domains cleared.");
    } catch (err) {
      setDomainsStatus(err instanceof Error ? err.message : "Unable to save domains.");
    }
  }

  function cellValue(row: Record<string, unknown>, names: string[]) {
    const entry = Object.entries(row).find(([key]) => names.includes(key.trim().toLowerCase().replace(/[_-]+/g, " ")));
    return String(entry?.[1] ?? "").trim();
  }

  async function previewBulkUsers(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setBulkRows([]);
    setBulkStatus("");
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const rows = records.map((record, index): BulkRow => {
        const name = cellValue(record, ["full name", "name", "student name", "teacher name"]);
        const email = cellValue(record, ["email", "email address", "college email"]).toLowerCase();
        // A row may omit its own password when a default password is set for the whole import.
        const password = cellValue(record, ["temporary password", "password", "temp password"]) || defaultPassword;
        const rawRole = cellValue(record, ["role", "account role", "user role"]).toLowerCase();
        const role = rawRole === "teacher" || rawRole === "faculty" ? "teacher" : rawRole === "admin" ? "admin" : "student";
        const studentId = cellValue(record, ["student id", "student number", "roll number", "roll no"]);
        const department = cellValue(record, ["department", "department name or code", "department name", "department code", "dept", "branch", "course", "program"]);
        const collegeCode = cellValue(record, ["college code", "college id", "institution code"]).toUpperCase();
        const matchedCollege = colleges.find((c) => c.code === collegeCode || c._id === collegeCode);
        const collegeId = matchedCollege?._id ?? "";
        const departmentId = matchedCollege?.departments.find((d) => d.code === department.toUpperCase() || d.name.toLowerCase() === department.toLowerCase())?._id ?? "";
        const emailDomain = email.includes("@") ? email.split("@").pop() ?? "" : "";
        const issues: string[] = [];
        if (!name) issues.push("Full Name is required");
        if (!/^\S+@\S+\.\S+$/.test(email)) issues.push("valid Email is required");
        if (password.length < 10) issues.push("password (or default) must have 10+ characters");
        if ((role === "student" || role === "teacher") && !collegeId) issues.push("valid College Code is required");
        if ((role === "student" || role === "teacher") && !departmentId) issues.push("valid Department name or code is required");
        if (matchedCollege && matchedCollege.domains?.length && emailDomain && !matchedCollege.domains.includes(emailDomain)) {
          issues.push(`email domain @${emailDomain} is not allowed for ${matchedCollege.code}`);
        }
        return { row: index + 2, name, email, role, password, studentId, department, collegeId, valid: issues.length === 0, issue: issues.join("; ") };
      });
      setBulkRows(rows);
      setBulkStatus(`${rows.filter((r) => r.valid).length} ready · ${rows.filter((r) => !r.valid).length} need attention · re-imports overwrite by email`);
    } catch {
      setBulkStatus("Unable to read this spreadsheet.");
    }
  }

  async function importBulkUsers() {
    const validRows = bulkRows.filter((r) => r.valid);
    if (!validRows.length) { setBulkStatus("There are no valid rows to import."); return; }
    setBulkStatus(`Importing ${validRows.length} accounts…`);
    try {
      const result = await api.createUsersBulk(
        validRows.map((r) => ({ name: r.name, email: r.email, role: r.role, temporaryPassword: r.password, studentId: r.studentId, department: r.department, collegeId: r.collegeId })),
        defaultPassword
      );
      setBulkStatus(`${result.created} created · ${result.updated} updated · ${result.rejected.length} rejected.`);
      setBulkRows([]);
      api.listUsers().then(({ users }) => setUsers(users)).catch(() => {});
    } catch (err) {
      setBulkStatus(err instanceof Error ? err.message : "Bulk import failed.");
    }
  }

  function downloadBulkTemplate() {
    const header = ["Full Name", "Email", "Role", "Temporary Password", "Student ID", "Department Name or Code", "College Code", "College Name"];
    const exampleRows = [
      ["Sample Student 1 - Replace", "replace.student01@example.edu", "student", "Learn@2026S1", "STU00001", "CSE", colleges[0]?.code, colleges[0]?.name],
    ];
    const worksheet = XLSX.utils.aoa_to_sheet([header, ...exampleRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
    XLSX.writeFile(workbook, "TarasLearn_Bulk_User_Template.xlsx");
    setBulkStatus("Template downloaded. Replace the sample learner details before upload.");
  }

  async function updateCourse(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const id = String(data.get("id") ?? "");
    try {
      const { course } = await api.updateCourse(id, readCourseForm(data));
      setCourses((items) => items.map((c) => (c.slug === course.slug || c._id === course._id ? course : c)));
      setEditingCourseId(null);
      setStatus(`Course “${course.title}” was updated.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Course update failed.");
    }
  }

  async function deleteCourse(id: string) {
    if (!window.confirm("Delete this course from the catalog?")) return;
    try {
      await api.deleteCourse(id);
      setCourses((items) => items.filter((c) => c._id !== id && c.slug !== id));
      setStatus("Course deleted.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Course deletion failed.");
    }
  }

  async function deleteUser(authUser: AuthUser) {
    if (!window.confirm(`Delete ${authUser.name} (${authUser.email})?`)) return;
    try {
      await api.deleteUser(authUser._id);
      setUsers((cur) => cur.filter((u) => u._id !== authUser._id));
      setStatus(`${authUser.name}'s account was deleted.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "User deletion failed.");
    }
  }

  async function changeUserDepartment(authUser: AuthUser, departmentId: string) {
    const college = colleges.find((c) => c._id === authUser.collegeId);
    const department = college?.departments.find((d) => d._id === departmentId)?.name ?? "";
    try {
      const { user: updated } = await api.assignUserDepartment(authUser._id, { departmentId, department });
      setUsers((cur) => cur.map((u) => (u._id === updated._id ? updated : u)));
      setStatus(`${updated.name} moved to ${department || "no department"}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Unable to move this account.");
    }
  }

  const views: { id: AdminView; label: string }[] = [
    { id: "overview", label: "Overview" },
    ...(isAdmin ? [{ id: "colleges" as AdminView, label: "Colleges" }] : []),
    { id: "departments", label: "Departments & Access" },
    { id: "content", label: "Content Library" },
    { id: "people", label: "People" },
    { id: "geography", label: "Student Geography" },
  ];

  return (
    <div className="page-content admin-page">
      <section className="page-intro split admin-hero">
        <div>
          <span className="eyebrow accent">{isAdmin ? "Platform administration" : "College administration"}</span>
          <h1>{isAdmin ? "Run every college from one place." : "Run your college."}</h1>
          <p>{isAdmin ? "Create colleges, appoint their college admins, and manage learners, courses, and content across the platform." : "Manage your departments, teachers, students, and the courses each department can access."}</p>
        </div>
      </section>

      <nav className="admin-tabs" aria-label="Dashboard sections">
        {views.map((view) => (
          <button
            key={view.id}
            type="button"
            className={`admin-tab ${adminView === view.id ? "active" : ""}`}
            onClick={() => setAdminView(view.id)}
          >
            {view.label}
          </button>
        ))}
      </nav>

      {adminView === "overview" && isStaff && (
        <>
          <section className="admin-kpis">
            <article><span><Users size={19} /></span><div><strong>{students.length}</strong><small>Total students</small></div><em>Directory</em></article>
            <article><span><GraduationCap size={19} /></span><div><strong>{teachers.length}</strong><small>Faculty accounts</small></div><em>Active team</em></article>
            <article><span><BookOpen size={19} /></span><div><strong>{courses.length}</strong><small>Published courses</small></div><em>Catalog</em></article>
            <article><span><MapPinned size={19} /></span><div><strong>{locatedStudents.length}</strong><small>Mapped learners</small></div><em>Across India</em></article>
          </section>

          {isAdmin && (
            <section className="overview-stats">
              <article className="overview-card"><span className="overview-icon"><Building2 size={20} /></span><div><strong>{colleges.length}</strong><small>Colleges</small></div></article>
              <article className="overview-card"><span className="overview-icon"><Layers size={20} /></span><div><strong>{totalDepartments}</strong><small>Departments</small></div></article>
              <article className="overview-card"><span className="overview-icon"><Library size={20} /></span><div><strong>{assets.length}</strong><small>Library resources</small></div></article>
            </section>
          )}

          <section className="overview-quick">
            <div className="section-heading"><div><span className="eyebrow">Get going</span><h2>Quick actions</h2></div></div>
            <div className="overview-quick-grid">
              {isAdmin && <button type="button" className="quick-card" onClick={() => setAdminView("colleges")}><Building2 size={18} /><span><strong>Colleges</strong><small>Add or review institutions</small></span></button>}
              <button type="button" className="quick-card" onClick={() => setAdminView("departments")}><Layers size={18} /><span><strong>Departments & access</strong><small>Grant courses by department</small></span></button>
              <button type="button" className="quick-card" onClick={() => setAdminView("content")}><Library size={18} /><span><strong>Content library</strong><small>Courses, videos & documents</small></span></button>
              <button type="button" className="quick-card" onClick={() => setAdminView("people")}><Users size={18} /><span><strong>People</strong><small>Create or import accounts</small></span></button>
              <button type="button" className="quick-card" onClick={() => setAdminView("geography")}><MapPinned size={18} /><span><strong>Student geography</strong><small>See learners across India</small></span></button>
            </div>
          </section>
        </>
      )}

      {adminView === "colleges" && isAdmin && (
        <section className="college-access-section">
          <div className="college-access-head">
            <div><span className="eyebrow">Institutions</span><h2>Colleges</h2><p>Create each college once, then open a card to preview its departments, people, and granted courses.</p></div>
            <button className="primary-button" type="button" onClick={() => setShowCollegeForm(true)}>＋ Add college</button>
          </div>
          <div className="college-cards">
            {colleges.map((college) => {
              const cTeachers = users.filter((u) => u.role === "teacher" && String(u.collegeId) === String(college._id)).length;
              const cStudents = users.filter((u) => u.role === "student" && String(u.collegeId) === String(college._id)).length;
              return (
                <button
                  type="button"
                  key={college._id}
                  className={`college-card ${selectedCollege?._id === college._id ? "selected" : ""}`}
                  onClick={() => { setSelectedCollegeId(college._id); setSelectedDepartmentId(""); setStructureCollegeId(college._id); }}
                >
                  <div className="college-card-head"><span className="pill">{college.code}</span><em className={college.active ? "is-active" : "is-paused"}>{college.active ? "Active" : "Paused"}</em></div>
                  <strong>{college.name}</strong>
                  <small>{college.state || "—"} · {college.domains?.length ? college.domains.join(", ") : "no domains"}</small>
                  <div className="college-card-stats"><em>{college.departments.length} depts</em><em>{cTeachers} teachers</em><em>{cStudents} students</em></div>
                  <span className="college-card-cta">View structure →</span>
                </button>
              );
            })}
          </div>
          {collegeStatus && <p className="college-status" role="status">{collegeStatus}</p>}
        </section>
      )}

      {adminView === "departments" && isStaff && (
        <section className="college-access-section">
          <div className="college-access-head">
            <div><span className="eyebrow">Institution access control</span><h2>Departments &amp; course access</h2><p>{isAdmin ? "Pick a college, open a department, and choose exactly which courses its students can discover, stream, and study." : "Add your departments, then choose which courses each department's students can access."}</p></div>
            <span className="access-security-badge">Backend enforced</span>
          </div>

          {isAdmin && (
            <div className="dept-college-picker">
              <label>College
                <select value={selectedCollege?._id ?? ""} onChange={(e) => { setSelectedCollegeId(e.target.value); setSelectedDepartmentId(""); }}>
                  {colleges.map((c) => <option value={c._id} key={c._id}>{c.code} — {c.name}</option>)}
                </select>
              </label>
              <span className="field-hint">{selectedCollege?.departments.length ?? 0} departments in {selectedCollege?.code ?? "—"}</span>
            </div>
          )}

          <div className="course-access-card" key={selectedCollege?._id ?? "empty"}>
            {selectedCollege ? (
              <>
                <div className="access-college-title">
                  <div><span className="pill">{selectedCollege.code}</span><h3>{selectedCollege.name}</h3><p>{directoryUsers.filter((u) => u.collegeId === selectedCollege._id && u.role === "student").length} assigned students</p></div>
                </div>
                <form className="college-domains-form" onSubmit={saveCollegeDomains}>
                  <div><strong>Email domains</strong><small>Route &amp; validate this college's accounts by email domain.</small></div>
                  <input value={domainsDraft} onChange={(e) => setDomainsDraft(e.target.value)} placeholder="abc.edu, drnpg.com" />
                  <button type="submit">Save domains</button>
                  {domainsStatus && <span className="domains-status" role="status">{domainsStatus}</span>}
                </form>
                <form className="department-create-row" onSubmit={createDepartment}>
                  <div><strong>Add department</strong><small>Create CSE, ECE, Mechanical, or another department.</small></div>
                  <input name="departmentName" required placeholder="Department name" />
                  <input name="departmentCode" required maxLength={15} placeholder="Code (CSE)" />
                  <button type="submit">Add</button>
                </form>
                <div className="department-cards">
                  {selectedCollege.departments.map((d) => {
                    const deptTeachers = users.filter((u) => u.role === "teacher" && String(u.departmentId) === String(d._id));
                    const deptStudents = users.filter((u) => u.role === "student" && String(u.departmentId) === String(d._id));
                    return (
                      <button
                        type="button"
                        key={d._id}
                        className={`department-card ${selectedDepartment?._id === d._id ? "active" : ""}`}
                        onClick={() => setSelectedDepartmentId(d._id)}
                      >
                        <div className="dept-card-head"><strong>{d.code}</strong><span>{d.name}</span></div>
                        <div className="dept-card-stats">
                          <em>{deptTeachers.length} teachers</em>
                          <em>{deptStudents.length} students</em>
                          <em>{d.allowedCourseIds.length} courses</em>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedDepartment && (() => {
                  const deptTeachers = users.filter((u) => u.role === "teacher" && String(u.departmentId) === String(selectedDepartment._id));
                  const deptStudents = users.filter((u) => u.role === "student" && String(u.departmentId) === String(selectedDepartment._id));
                  const deptCourses = courses.filter((c) => selectedDepartment.allowedCourseIds.includes(c.slug));
                  return (
                    <>
                      <div className="department-structure">
                        <div className="dept-structure-col">
                          <h4>Teachers <span>{deptTeachers.length}</span></h4>
                          {deptTeachers.length ? deptTeachers.map((t) => (
                            <div className="dept-person" key={t._id}><span className="directory-avatar">{t.name.slice(0, 1)}</span><span><strong>{t.name}</strong><small>{t.email}</small></span></div>
                          )) : <p className="empty-inline">No teachers assigned yet.</p>}
                        </div>
                        <div className="dept-structure-col">
                          <h4>Students <span>{deptStudents.length}</span></h4>
                          {deptStudents.length ? deptStudents.map((s) => (
                            <div className="dept-person" key={s._id}><span className="directory-avatar">{s.name.slice(0, 1)}</span><span><strong>{s.name}</strong><small>{s.email}{s.studentId ? ` · ${s.studentId}` : ""}</small></span></div>
                          )) : <p className="empty-inline">No students assigned yet.</p>}
                        </div>
                        <div className="dept-structure-col">
                          <h4>Granted courses <span>{deptCourses.length}</span></h4>
                          {deptCourses.length ? deptCourses.map((c) => (
                            <div className="dept-person" key={c.slug}><span className="mini-icon" style={{ background: c.color }}>{c.icon}</span><span><strong>{c.title}</strong><small>{c.category}</small></span></div>
                          )) : <p className="empty-inline">No courses granted yet.</p>}
                        </div>
                      </div>
                      <form className="department-course-form" key={selectedDepartment._id} onSubmit={saveCollegeAccess}>
                        <div className="course-access-toolbar"><strong>Courses for {selectedDepartment.name}</strong><span>{selectedDepartment.allowedCourseIds.length} of {courses.length} selected</span></div>
                        <div className="course-access-grid">
                          {courses.map((course) => {
                            const owner = users.find((u) => u.email === course.createdBy);
                            const fromDept =
                              owner?.role === "teacher" &&
                              (String(owner.departmentId) === String(selectedDepartment._id) ||
                                Boolean(
                                  owner.department &&
                                    owner.department.toLowerCase() === selectedDepartment.name.toLowerCase()
                                ));
                            return (
                              <label key={course.slug} className={fromDept ? "auto-granted" : ""}>
                                <input type="checkbox" name="courseIds" value={course.slug} defaultChecked={selectedDepartment.allowedCourseIds.includes(course.slug) || fromDept} disabled={fromDept} />
                                <span className="mini-icon" style={{ background: course.color }}>{course.icon}</span>
                                <span><strong>{course.title}</strong><small>{course.category} · {course.level} · by {courseAuthorLabel(course)}</small></span>
                                {fromDept && <i className="dept-badge" title="Published by this department's faculty — always available to its students">this dept</i>}
                                <b>✓</b>
                              </label>
                            );
                          })}
                        </div>
                        <input type="hidden" name="active" value="on" />
                        <div className="access-actions"><p>Students in this department see every course you tick plus any course published by the department's own faculty (tagged "this dept").</p><button className="primary-button" type="submit">Save access <span>→</span></button></div>
                      </form>
                    </>
                  );
                })()}
              </>
            ) : (
              <div className="empty-state">Create a college to begin assigning course access.</div>
            )}
          </div>
          {collegeStatus && <p className="college-status" role="status">{collegeStatus}</p>}
        </section>
      )}

      {adminView === "content" && isStaff && (
        <>
          <div className="college-access-head">
            <div><span className="eyebrow">Content library</span><h2>{isAdmin ? "All platform courses & files" : "Your college's courses & files"}</h2><p>{isAdmin ? "Create courses, upload recordings and documents, and edit or remove any resource." : "Upload recordings and documents to your college's courses, and edit or remove the files you own."}</p></div>
          </div>

          {isAdmin && (
            <>
          <section className="admin-tools-grid">
            <form className="admin-tool-card" onSubmit={createCourse}>
              <div className="tool-card-head"><span>01</span><div><span className="eyebrow">Course management</span><h2>Create a new course</h2></div></div>
              <CourseFields />
              <div className="course-push">
                <div className="course-push-head">
                  <strong>Push to colleges &amp; departments</strong>
                  <small>Optional — grant this new course to specific departments right away.</small>
                </div>
                {colleges.length ? colleges.map((college) => {
                  const depts = college.departments;
                  const allOn = depts.length > 0 && depts.every((d) => pushTargets[d._id]);
                  return (
                    <div className="course-push-college" key={college._id}>
                      <label className="push-college">
                        <input
                          type="checkbox"
                          checked={allOn}
                          onChange={() => setPushTargets((prev) => {
                            const next = { ...prev };
                            depts.forEach((d) => { if (allOn) delete next[d._id]; else next[d._id] = true; });
                            return next;
                          })}
                        />
                        <span><strong>{college.code}</strong> {college.name}</span>
                      </label>
                      <div className="push-depts">
                        {depts.length ? depts.map((d) => (
                          <label key={d._id} className={pushTargets[d._id] ? "on" : ""}>
                            <input type="checkbox" checked={!!pushTargets[d._id]} onChange={() => setPushTargets((prev) => ({ ...prev, [d._id]: !prev[d._id] }))} />
                            {d.code}
                          </label>
                        )) : <small className="empty-inline">No departments yet.</small>}
                      </div>
                    </div>
                  );
                }) : <small className="empty-inline">Create a college and its first department to push courses.</small>}
              </div>
            </form>
          </section>

          <section className="management-section">
            <div className="section-heading"><div><span className="eyebrow">Course controls</span><h2>Edit or delete courses</h2></div></div>
            <div className="management-list">
              {courses.map((course) =>
                curriculumCourseId === course.slug ? (
                  <CurriculumBuilder
                    key={course.slug}
                    course={course}
                    onSaved={(updated) => {
                      setCourses((items) => items.map((c) => (c.slug === updated.slug || c._id === updated._id ? updated : c)));
                      setCurriculumCourseId(null);
                    }}
                    onAssetUploaded={(asset) => setAssets((cur) => [asset, ...cur])}
                    onClose={() => setCurriculumCourseId(null)}
                  />
                ) : editingCourseId === course.slug ? (
                  <form className="management-edit" key={course.slug} onSubmit={updateCourse}>
                    <input type="hidden" name="id" value={course.slug} />
                    <CourseFields initial={course} submitLabel="Save changes" onCancel={() => setEditingCourseId(null)} />
                  </form>
                ) : (
                  <div className="management-item" key={course.slug}>
                    <span className="mini-icon" style={{ background: course.color }}>{course.icon}</span>
                    <span><strong>{course.title}</strong><small>{course.category} · {course.level} · by {courseAuthorLabel(course)}</small></span>
                    <div className="management-actions">
                      <button className="text-button" onClick={() => { setCurriculumCourseId(course.slug); setEditingCourseId(null); }}>Curriculum</button>
                      <button className="text-button" onClick={() => { setEditingCourseId(course.slug); setCurriculumCourseId(null); }}>Edit</button>
                      <button className="danger-button" onClick={() => deleteCourse(course._id ?? course.slug)}>Delete</button>
                    </div>
                  </div>
                )
              )}
            </div>
          </section>
            </>
          )}

          <div className="admin-grid">
            <AssetUploader courses={contentCourses} onUploaded={(asset) => setAssets((cur) => [asset, ...cur])} />
            <section className="publish-checklist"><span className="eyebrow">Publishing checklist</span><h2>Make every lesson land.</h2>
              {[["01", "Clear title", "Tell learners exactly what they will be able to do."], ["02", "Focused recording", "Keep each video centered on one practical outcome."], ["03", "Useful resources", "Add notes, references, or exercises beside the lesson."], ["04", "Knowledge check", "Finish a module with practice and a short quiz."]].map((item) => (
                <div key={item[0]}><span>{item[0]}</span><p><strong>{item[1]}</strong><small>{item[2]}</small></p></div>
              ))}
            </section>
          </div>

          <section className="library-section">
            <div className="section-heading"><div><span className="eyebrow">Content library</span><h2>Edit or delete uploaded resources</h2></div></div>
            {assets.length ? (
              <AssetTable
                assets={assets}
                courses={contentCourses}
                canManage={() => true}
                onUpdated={(asset) => setAssets((items) => items.map((a) => (a._id === asset._id ? asset : a)))}
                onDeleted={(asset) => setAssets((items) => items.filter((a) => a._id !== asset._id))}
              />
            ) : (
              <div className="empty-library"><span>□</span><h3>Your library is ready</h3><p>Upload the first recorded lesson or course document to begin.</p></div>
            )}
          </section>
        </>
      )}

      {adminView === "people" && isStaff && (
        <>
          <section className="admin-tools-grid">
            <form className="admin-tool-card" onSubmit={createUser}>
              <div className="tool-card-head"><span>01</span><div><span className="eyebrow">Access management</span><h2>Create a user login</h2></div></div>
              <div className="form-row"><label>Full name<input name="name" required placeholder="Teacher or student name" /></label><label>Account role<select name="role" defaultValue="student"><option value="student">Student</option><option value="teacher">Teacher</option>{isAdmin && <option value="collegeAdmin">College admin</option>}{isAdmin && <option value="admin">Administrator</option>}</select></label></div>
              <div className="form-row">
                <label>College<select name="collegeId" value={userCollegeId} onChange={(e) => setUserCollegeId(e.target.value)}>{isAdmin && <option value="">No college / platform account</option>}{colleges.filter((c) => c.active).map((c) => <option value={c._id} key={c._id}>{c.code} — {c.name}</option>)}</select></label>
                <label>Department<select name="departmentId" key={userCollegeId}><option value="">Select department</option>{colleges.find((c) => c._id === userCollegeId)?.departments.filter((d) => d.active).map((d) => <option value={d._id} key={d._id}>{d.code} — {d.name}</option>)}</select></label>
              </div>
              <label>Email<input name="email" type="email" required placeholder="user@example.com" /></label>
              <label>Temporary password<input name="password" type="password" minLength={10} required placeholder="Minimum 10 characters" /></label>
              <button className="primary-button" type="submit">Create login <span>→</span></button>
            </form>
          </section>

          <section className="bulk-import-section">
            <div className="bulk-import-head">
              <div><span className="eyebrow">Bulk enrollment</span><h2>Create users from Excel</h2><p>Download a template, replace the sample rows, and import learners in bulk.</p></div>
              <button className="outline-small" type="button" onClick={downloadBulkTemplate}>↓ Download Excel template</button>
            </div>
            <div className="bulk-import-controls">
              <label className="file-drop compact"><input type="file" accept=".xlsx,.xls,.csv" onChange={previewBulkUsers} /><span>Choose Excel or CSV file</span><small>.xlsx, .xls, or .csv · the Users worksheet will be imported</small></label>
              <label className="bulk-default-password">Default password (optional)<input type="text" value={defaultPassword} onChange={(e) => setDefaultPassword(e.target.value)} placeholder="Used for rows without a password" /><small>Re-importing an existing email overwrites that account.</small></label>
              {bulkStatus && <p className="bulk-status" role="status">{bulkStatus}</p>}
            </div>
            {bulkRows.length > 0 && (
              <>
                <button className="primary-button bulk-create-button" type="button" disabled={!bulkRows.some((r) => r.valid)} onClick={importBulkUsers}>
                  Create {bulkRows.filter((r) => r.valid).length} valid accounts <span>→</span>
                </button>
                <div className="bulk-preview">
                  {bulkRows.slice(0, 30).map((row) => (
                    <div className={`bulk-row ${row.valid ? "" : "row-invalid"}`} key={row.row}>
                      <span>{row.row}</span><span>{row.name}</span><span>{row.email}</span><span>{row.role}</span><span>{row.valid ? "Ready" : row.issue}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="management-section">
            <div className="section-heading"><div><span className="eyebrow">User controls</span><h2>Manage created users</h2></div></div>
            <div className="management-list">
              {directoryUsers.length ? directoryUsers.map((authUser) => (
                <div className="management-item user-management-item" key={authUser._id}>
                  <span className="directory-avatar">{authUser.name.slice(0, 1)}</span>
                  <span><strong>{authUser.name}</strong><small>{authUser.email} · {authUser.role}{authUser.department ? ` · ${authUser.department}` : ""}</small></span>
                  <div className="management-actions">
                    {(authUser.role === "student" || authUser.role === "teacher") && (
                      <select
                        className="dept-reassign"
                        value={authUser.departmentId ?? ""}
                        onChange={(e) => changeUserDepartment(authUser, e.target.value)}
                        aria-label={`Department for ${authUser.name}`}
                      >
                        <option value="">No department</option>
                        {(colleges.find((c) => c._id === authUser.collegeId)?.departments ?? []).map((d) => (
                          <option value={d._id} key={d._id}>{d.code} — {d.name}</option>
                        ))}
                      </select>
                    )}
                    <button className="danger-button" type="button" onClick={() => deleteUser(authUser)}>Delete user</button>
                  </div>
                </div>
              )) : <div className="empty-state">No student or teacher accounts have been created.</div>}
            </div>
          </section>
        </>
      )}

      {adminView === "geography" && isStaff && (
        <section className="student-map-section">
          <div className="student-map-head">
            <div><span className="eyebrow">Interactive student geography</span><h2>Explore college locations across India</h2><p>Click a marker to zoom in, drag the map to explore, or select a student from the directory.</p></div>
            <div className="map-metrics"><span><strong>{students.length}</strong> students</span><span><strong>{locatedStudents.length}</strong> mapped</span></div>
          </div>
          <div className="student-map-grid">
            <div className="india-map-card">
              <AdminStudentMap students={locatedStudents} selectedUserId={selectedUserId} onSelectUser={setSelectedUserId} />
              <small className="map-credit">Interactive state-level locations from student-submitted profiles. Map data © OpenStreetMap contributors.</small>
            </div>
            <div className="student-directory">
              <div className="directory-list"><h3>Student and teacher directory</h3>
                {directoryUsers.length ? directoryUsers.map((authUser) => (
                  <button type="button" className={selectedUserId === authUser._id ? "selected" : ""} key={authUser._id} onClick={() => setSelectedUserId(authUser._id)}>
                    <span className="directory-avatar">{authUser.name.slice(0, 1)}</span>
                    <span><strong>{authUser.name}</strong><small>{authUser.role} · {authUser.email}{authUser.department ? ` · ${authUser.department}` : ""}</small></span>
                    <b>{authUser.profile?.complete ? "View" : "Pending"}</b>
                  </button>
                )) : <div className="empty-state">No student or teacher accounts yet.</div>}
              </div>
            </div>
          </div>
        </section>
      )}

      {showCollegeForm && (
        <SidePanel title="Add a college" subtitle="New institution" onClose={() => setShowCollegeForm(false)}>
          <form className="create-college-card" onSubmit={createCollege}>
            <h3>College details</h3>
            <label>College name<input name="name" required placeholder="e.g. ABC Engineering College" /></label>
            <div className="form-row"><label>College code<input name="code" required maxLength={20} placeholder="ABCEC" /></label><label>State<select name="state" required defaultValue=""><option value="" disabled>Select state</option>{INDIA_STATES.map((state) => <option key={state}>{state}</option>)}</select></label></div>
            <label>Email domains<input name="domains" placeholder="abc.edu, drnpg.com (comma separated)" /><small className="field-hint">Accounts with these email domains are routed to this college.</small></label>
            <h3>College admin (gives them the ABC portal)</h3>
            <label>Admin name<input name="adminName" required placeholder="e.g. Priya Sharma" /></label>
            <div className="form-row"><label>Admin email<input name="adminEmail" type="email" required placeholder="admin@abc.edu" /></label><label>Temporary password<input name="adminPassword" type="password" minLength={10} required placeholder="Minimum 10 characters" /></label></div>
            <div className="panel-form-actions">
              <button className="outline-small" type="button" onClick={() => setShowCollegeForm(false)}>Cancel</button>
              <button className="primary-button" type="submit">Create college <span>→</span></button>
            </div>
            {collegeStatus && <p className="college-status" role="status">{collegeStatus}</p>}
          </form>
        </SidePanel>
      )}

      {structureCollege && (() => {
        const cTeachers = users.filter((u) => u.role === "teacher" && String(u.collegeId) === String(structureCollege._id));
        const cStudents = users.filter((u) => u.role === "student" && String(u.collegeId) === String(structureCollege._id));
        return (
          <SidePanel
            subtitle="College structure"
            title={<><span className="pill">{structureCollege.code}</span> {structureCollege.name}</>}
            onClose={() => setStructureCollegeId(null)}
            footer={<button className="primary-button" type="button" onClick={() => { setSelectedCollegeId(structureCollege._id); setSelectedDepartmentId(""); setStructureCollegeId(null); setAdminView("departments"); }}>Manage course access <span>→</span></button>}
          >
            <div className="college-structure-meta">
              <span><strong>{structureCollege.departments.length}</strong> departments</span>
              <span><strong>{cTeachers.length}</strong> teachers</span>
              <span><strong>{cStudents.length}</strong> students</span>
              <span>{structureCollege.state || "—"}</span>
            </div>
            <p className="structure-domains">Domains: {structureCollege.domains?.length ? structureCollege.domains.join(", ") : "none set"}</p>
            {structureCollege.departments.length ? structureCollege.departments.map((d) => {
              const deptTeachers = users.filter((u) => u.role === "teacher" && String(u.departmentId) === String(d._id));
              const deptStudents = users.filter((u) => u.role === "student" && String(u.departmentId) === String(d._id));
              const deptCourses = courses.filter((c) => d.allowedCourseIds.includes(c.slug));
              return (
                <div className="modal-dept" key={d._id}>
                  <div className="modal-dept-head"><span className="pill">{d.code}</span><strong>{d.name}</strong><div className="dept-card-stats"><em>{deptTeachers.length} teachers</em><em>{deptStudents.length} students</em><em>{deptCourses.length} courses</em></div></div>
                  <div className="department-structure">
                    <div className="dept-structure-col">
                      <h4>Teachers <span>{deptTeachers.length}</span></h4>
                      {deptTeachers.length ? deptTeachers.map((t) => (<div className="dept-person" key={t._id}><span className="directory-avatar">{t.name.slice(0, 1)}</span><span><strong>{t.name}</strong><small>{t.email}</small></span></div>)) : <p className="empty-inline">None</p>}
                    </div>
                    <div className="dept-structure-col">
                      <h4>Students <span>{deptStudents.length}</span></h4>
                      {deptStudents.length ? deptStudents.map((s) => (<div className="dept-person" key={s._id}><span className="directory-avatar">{s.name.slice(0, 1)}</span><span><strong>{s.name}</strong><small>{s.email}{s.studentId ? ` · ${s.studentId}` : ""}</small></span></div>)) : <p className="empty-inline">None</p>}
                    </div>
                    <div className="dept-structure-col">
                      <h4>Courses <span>{deptCourses.length}</span></h4>
                      {deptCourses.length ? deptCourses.map((c) => (<div className="dept-person" key={c.slug}><span className="mini-icon" style={{ background: c.color }}>{c.icon}</span><span><strong>{c.title}</strong><small>{c.category}</small></span></div>)) : <p className="empty-inline">None</p>}
                    </div>
                  </div>
                </div>
              );
            }) : <div className="empty-state">No departments yet.</div>}
          </SidePanel>
        );
      })()}

      {status && <p className="admin-status" role="status">{status}</p>}
    </div>
  );
}
