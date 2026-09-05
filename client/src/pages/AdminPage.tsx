import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { BookOpen, GraduationCap, MapPinned, Users } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Asset, AuthUser, College, Course } from "../types";
import { formatBytes, INDIA_STATES } from "../data/constants";
import AdminStudentMap from "../components/AdminStudentMap";

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
  const [status, setStatus] = useState("");
  const [collegeStatus, setCollegeStatus] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userCollegeId, setUserCollegeId] = useState("");

  const isAdmin = user?.role === "admin";

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

  if (!user) return null;

  async function createCourse(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setStatus("Creating course…");
    try {
      const { course } = await api.createCourse({
        title: form.get("title"),
        category: form.get("category"),
        description: form.get("description"),
        level: form.get("level"),
        icon: form.get("icon"),
      });
      setCourses((cur) => [course, ...cur]);
      setStatus(`Course “${course.title}” is live.`);
      e.currentTarget.reset();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Course creation failed.");
    }
  }

  async function createUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setStatus("Creating login…");
    try {
      const role = String(form.get("role") ?? "student");
      const collegeId = String(form.get("collegeId") ?? "");
      const departmentId = String(form.get("departmentId") ?? "");
      const department = colleges
        .find((c) => c._id === collegeId)
        ?.departments.find((d) => d._id === departmentId)?.name ?? "";
      if (role === "student" && !collegeId) throw new Error("Select a college for this student account.");
      if (role === "student" && !departmentId) throw new Error("Select a department for this student account.");
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
      e.currentTarget.reset();
      setUserCollegeId("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Account creation failed.");
    }
  }

  async function createCollege(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setCollegeStatus("Creating college…");
    try {
      const { college } = await api.createCollege({ name: form.get("name"), code: form.get("code"), state: form.get("state") });
      setColleges((cur) => [college, ...cur]);
      setSelectedCollegeId(college._id);
      setCollegeStatus(`${college.name} created. Now add its first department.`);
      e.currentTarget.reset();
    } catch (err) {
      setCollegeStatus(err instanceof Error ? err.message : "Unable to create college.");
    }
  }

  async function createDepartment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedCollege) return;
    const form = new FormData(e.currentTarget);
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
      e.currentTarget.reset();
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
      const existing = new Set(users.map((u) => u.email));
      const seen = new Set<string>();
      const rows = records.map((record, index): BulkRow => {
        const name = cellValue(record, ["full name", "name", "student name", "teacher name"]);
        const email = cellValue(record, ["email", "email address", "college email"]).toLowerCase();
        const password = cellValue(record, ["temporary password", "password", "temp password"]);
        const rawRole = cellValue(record, ["role", "account role", "user role"]).toLowerCase();
        const role = rawRole === "teacher" || rawRole === "faculty" ? "teacher" : rawRole === "admin" ? "admin" : "student";
        const studentId = cellValue(record, ["student id", "student number", "roll number", "roll no"]);
        const department = cellValue(record, ["department", "department name or code", "department name", "department code", "dept", "branch", "course", "program"]);
        const collegeCode = cellValue(record, ["college code", "college id", "institution code"]).toUpperCase();
        const matchedCollege = colleges.find((c) => c.code === collegeCode || c._id === collegeCode);
        const collegeId = matchedCollege?._id ?? "";
        const departmentId = matchedCollege?.departments.find((d) => d.code === department.toUpperCase() || d.name.toLowerCase() === department.toLowerCase())?._id ?? "";
        const issues: string[] = [];
        if (!name) issues.push("Full Name is required");
        if (!/^\S+@\S+\.\S+$/.test(email)) issues.push("valid Email is required");
        if (password.length < 10) issues.push("Password must have 10+ characters");
        if (existing.has(email)) issues.push("email already exists");
        if (seen.has(email)) issues.push("duplicate email in file");
        if (role === "student" && !collegeId) issues.push("valid College Code is required");
        if (role === "student" && !departmentId) issues.push("valid Department name or code is required");
        if (email) seen.add(email);
        return { row: index + 2, name, email, role, password, studentId, department, collegeId, valid: issues.length === 0, issue: issues.join("; ") };
      });
      setBulkRows(rows);
      setBulkStatus(`${rows.filter((r) => r.valid).length} ready · ${rows.filter((r) => !r.valid).length} need attention`);
    } catch {
      setBulkStatus("Unable to read this spreadsheet.");
    }
  }

  async function importBulkUsers() {
    const validRows = bulkRows.filter((r) => r.valid);
    if (!validRows.length) { setBulkStatus("There are no valid rows to import."); return; }
    setBulkStatus(`Creating ${validRows.length} accounts…`);
    try {
      const result = await api.createUsersBulk(validRows.map((r) => ({ name: r.name, email: r.email, role: r.role, temporaryPassword: r.password, studentId: r.studentId, department: r.department, collegeId: r.collegeId })));
      setBulkStatus(`${result.created} accounts created. ${result.rejected.length} rows were rejected.`);
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
    const form = new FormData(e.currentTarget);
    const id = String(form.get("id") ?? "");
    const values = { title: form.get("title"), category: form.get("category"), description: form.get("description"), level: form.get("level"), icon: form.get("icon") };
    try {
      const { course } = await api.updateCourse(id, values);
      setCourses((items) => items.map((c) => (c.slug === course.slug ? course : c)));
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

  async function uploadAsset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File)) return;
    setStatus("Uploading…");
    try {
      const { asset } = await api.createAsset({
        title: form.get("title"),
        course: form.get("course"),
        kind: form.get("kind"),
        mimeType: file.type,
        size: file.size,
        url: URL.createObjectURL(file),
      });
      setAssets((cur) => [asset, ...cur]);
      setStatus("Published to the course library.");
      e.currentTarget.reset();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  async function updateAsset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const id = String(form.get("id") ?? "");
    const values = { title: form.get("title"), course: form.get("course") };
    try {
      const { asset } = await api.updateAsset(id, values);
      setAssets((items) => items.map((a) => (a._id === asset._id ? asset : a)));
      setEditingAssetId(null);
      setStatus("Content updated.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Content update failed.");
    }
  }

  async function deleteAsset(asset: Asset) {
    if (!window.confirm(`Permanently delete “${asset.title}”?`)) return;
    try {
      await api.deleteAsset(asset._id);
      setAssets((items) => items.filter((a) => a._id !== asset._id));
      setStatus("Content deleted.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Content deletion failed.");
    }
  }

  const students = directoryUsers.filter((u) => u.role === "student");
  const teachers = directoryUsers.filter((u) => u.role === "teacher");

  return (
    <div className="page-content admin-page">
      <section className="page-intro split admin-hero">
        <div>
          <span className="eyebrow accent">Instructor studio</span>
          <h1>Build learning that scales.</h1>
          <p>Manage learners, courses, content, insights, and college engagement from one focused workspace.</p>
        </div>
      </section>

      {isAdmin && (
        <section className="admin-kpis">
          <article><span><Users size={19} /></span><div><strong>{students.length}</strong><small>Total students</small></div><em>Directory</em></article>
          <article><span><GraduationCap size={19} /></span><div><strong>{teachers.length}</strong><small>Faculty accounts</small></div><em>Active team</em></article>
          <article><span><BookOpen size={19} /></span><div><strong>{courses.length}</strong><small>Published courses</small></div><em>Catalog</em></article>
          <article><span><MapPinned size={19} /></span><div><strong>{locatedStudents.length}</strong><small>Mapped learners</small></div><em>Across India</em></article>
        </section>
      )}

      {isAdmin && (
        <section className="admin-tools-grid">
          <form className="admin-tool-card" onSubmit={createCourse}>
            <div className="tool-card-head"><span>01</span><div><span className="eyebrow">Course management</span><h2>Create a new course</h2></div></div>
            <div className="form-row"><label>Course title<input name="title" required placeholder="e.g. Aerospace Engineering" /></label><label>Category<input name="category" required placeholder="e.g. Aerospace" /></label></div>
            <label>Description<textarea name="description" required placeholder="What will learners build?" /></label>
            <div className="form-row"><label>Level<select name="level" defaultValue="Beginner"><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label><label>Short icon<input name="icon" maxLength={3} placeholder="AE" /></label></div>
            <button className="primary-button" type="submit">Create & publish <span>→</span></button>
          </form>
          <form className="admin-tool-card" onSubmit={createUser}>
            <div className="tool-card-head"><span>02</span><div><span className="eyebrow">Access management</span><h2>Create a user login</h2></div></div>
            <div className="form-row"><label>Full name<input name="name" required placeholder="Teacher or student name" /></label><label>Account role<select name="role" defaultValue="student"><option value="student">Student</option><option value="teacher">Teacher</option><option value="admin">Administrator</option></select></label></div>
            <div className="form-row">
              <label>College<select name="collegeId" value={userCollegeId} onChange={(e) => setUserCollegeId(e.target.value)}><option value="">No college / platform account</option>{colleges.filter((c) => c.active).map((c) => <option value={c._id} key={c._id}>{c.code} — {c.name}</option>)}</select></label>
              <label>Department<select name="departmentId" key={userCollegeId}><option value="">Select department</option>{colleges.find((c) => c._id === userCollegeId)?.departments.filter((d) => d.active).map((d) => <option value={d._id} key={d._id}>{d.code} — {d.name}</option>)}</select></label>
            </div>
            <label>Email<input name="email" type="email" required placeholder="user@example.com" /></label>
            <label>Temporary password<input name="password" type="password" minLength={10} required placeholder="Minimum 10 characters" /></label>
            <button className="primary-button" type="submit">Create login <span>→</span></button>
          </form>
        </section>
      )}

      {isAdmin && (
        <section className="college-access-section">
          <div className="college-access-head">
            <div><span className="eyebrow">Institution access control</span><h2>Colleges &amp; course access</h2><p>Create each institution once, then choose exactly which courses its students can discover, stream, and study.</p></div>
            <span className="access-security-badge">Backend enforced</span>
          </div>
          <div className="college-access-layout">
            <form className="create-college-card" onSubmit={createCollege}>
              <h3>1. Add a college</h3>
              <label>College name<input name="name" required placeholder="e.g. ABC Engineering College" /></label>
              <div className="form-row"><label>College code<input name="code" required maxLength={20} placeholder="ABCEC" /></label><label>State<select name="state" required defaultValue=""><option value="" disabled>Select state</option>{INDIA_STATES.map((state) => <option key={state}>{state}</option>)}</select></label></div>
              <button className="primary-button" type="submit">Create college <span>→</span></button>
              <div className="college-list"><strong>{colleges.length} registered colleges</strong>
                {colleges.map((college) => (
                  <button className={selectedCollege?._id === college._id ? "selected" : ""} type="button" key={college._id}
                    onClick={() => { setSelectedCollegeId(college._id); setSelectedDepartmentId(college.departments[0]?._id ?? ""); }}>
                    <span>{college.code.slice(0, 3)}</span><div><b>{college.name}</b><small>{college.state} · {college.departments.length} departments</small></div><em>{college.active ? "Active" : "Paused"}</em>
                  </button>
                ))}
              </div>
            </form>
            <div className="course-access-card" key={selectedCollege?._id ?? "empty"}>
              {selectedCollege ? (
                <>
                  <div className="access-college-title">
                    <div><span className="pill">{selectedCollege.code}</span><h3>{selectedCollege.name}</h3><p>{directoryUsers.filter((u) => u.collegeId === selectedCollege._id && u.role === "student").length} assigned students</p></div>
                  </div>
                  <form className="department-create-row" onSubmit={createDepartment}>
                    <div><strong>2. Add department</strong><small>Create CSE, ECE, Mechanical, or another department.</small></div>
                    <input name="departmentName" required placeholder="Department name" />
                    <input name="departmentCode" required maxLength={15} placeholder="Code (CSE)" />
                    <button type="submit">Add</button>
                  </form>
                  <div className="department-tabs">
                    {selectedCollege.departments.map((d) => (
                      <button type="button" className={selectedDepartment?._id === d._id ? "active" : ""} key={d._id} onClick={() => setSelectedDepartmentId(d._id)}>
                        <strong>{d.code}</strong><small>{d.name}</small>
                      </button>
                    ))}
                  </div>
                  {selectedDepartment && (
                    <form className="department-course-form" key={selectedDepartment._id} onSubmit={saveCollegeAccess}>
                      <div className="course-access-toolbar"><strong>3. Courses for {selectedDepartment.name}</strong><span>{selectedDepartment.allowedCourseIds.length} of {courses.length} selected</span></div>
                      <div className="course-access-grid">
                        {courses.map((course) => (
                          <label key={course.slug}>
                            <input type="checkbox" name="courseIds" value={course.slug} defaultChecked={selectedDepartment.allowedCourseIds.includes(course.slug)} />
                            <span className="mini-icon" style={{ background: course.color }}>{course.icon}</span>
                            <span><strong>{course.title}</strong><small>{course.category} · {course.level}</small></span>
                            <b>✓</b>
                          </label>
                        ))}
                      </div>
                      <input type="hidden" name="active" value="on" />
                      <div className="access-actions"><p>Only students assigned to this college and department receive these courses.</p><button className="primary-button" type="submit">Save access <span>→</span></button></div>
                    </form>
                  )}
                </>
              ) : (
                <div className="empty-state">Create a college to begin assigning course access.</div>
              )}
            </div>
          </div>
          {collegeStatus && <p className="college-status" role="status">{collegeStatus}</p>}
        </section>
      )}

      {isAdmin && (
        <>
          <section className="bulk-import-section">
            <div className="bulk-import-head">
              <div><span className="eyebrow">Bulk enrollment</span><h2>Create users from Excel</h2><p>Download a template, replace the sample rows, and import learners in bulk.</p></div>
              <button className="outline-small" type="button" onClick={downloadBulkTemplate}>↓ Download Excel template</button>
            </div>
            <div className="bulk-import-controls">
              <label className="file-drop compact"><input type="file" accept=".xlsx,.xls,.csv" onChange={previewBulkUsers} /><span>Choose Excel or CSV file</span><small>.xlsx, .xls, or .csv · the Users worksheet will be imported</small></label>
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
                  <span><strong>{authUser.name}</strong><small>{authUser.email} · {authUser.role}</small></span>
                  <div className="management-actions"><button className="danger-button" type="button" onClick={() => deleteUser(authUser)}>Delete user</button></div>
                </div>
              )) : <div className="empty-state">No student or teacher accounts have been created.</div>}
            </div>
          </section>

          <section className="management-section">
            <div className="section-heading"><div><span className="eyebrow">Course controls</span><h2>Edit or delete courses</h2></div></div>
            <div className="management-list">
              {courses.map((course) =>
                editingCourseId === course.slug ? (
                  <form className="management-edit" key={course.slug} onSubmit={updateCourse}>
                    <input type="hidden" name="id" value={course.slug} />
                    <div className="form-row"><label>Course title<input name="title" defaultValue={course.title} required /></label><label>Category<input name="category" defaultValue={course.category} required /></label></div>
                    <label>Description<textarea name="description" defaultValue={course.description} required /></label>
                    <div className="form-row"><label>Level<select name="level" defaultValue={course.level}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label><label>Short icon<input name="icon" maxLength={3} defaultValue={course.icon} /></label></div>
                    <div className="management-actions"><button className="primary-small" type="submit">Save changes</button><button className="text-button" type="button" onClick={() => setEditingCourseId(null)}>Cancel</button></div>
                  </form>
                ) : (
                  <div className="management-item" key={course.slug}>
                    <span className="mini-icon" style={{ background: course.color }}>{course.icon}</span>
                    <span><strong>{course.title}</strong><small>{course.category} · {course.level}</small></span>
                    <div className="management-actions">
                      <button className="text-button" onClick={() => setEditingCourseId(course.slug)}>Edit</button>
                      <button className="danger-button" onClick={() => deleteCourse(course._id ?? course.slug)}>Delete</button>
                    </div>
                  </div>
                )
              )}
            </div>
          </section>

          <div className="admin-grid">
            <form className="upload-card" onSubmit={uploadAsset}>
              <div className="upload-head"><span className="upload-symbol">↑</span><div><h2>Add course content</h2><p>Reference videos and documents for learners.</p></div></div>
              <label>Content title<input name="title" required placeholder="e.g. Introduction to embedded systems" /></label>
              <div className="form-row"><label>Course<select name="course" defaultValue={courses[0]?.slug}>{courses.map((course) => <option key={course.slug} value={course.slug}>{course.title}</option>)}</select></label><label>Content type<select name="kind" defaultValue="video"><option value="video">Recorded video</option><option value="document">Course document</option></select></label></div>
              <label className="file-drop"><input name="file" type="file" required accept="video/mp4,video/webm,application/pdf,text/plain,.doc,.docx" /><span>Choose a video or document</span><small>MP4, WebM, PDF, TXT, DOC or DOCX</small></label>
              <button className="primary-button" type="submit">Upload & publish <span>→</span></button>
            </form>
            <section className="publish-checklist"><span className="eyebrow">Publishing checklist</span><h2>Make every lesson land.</h2>
              {[["01", "Clear title", "Tell learners exactly what they will be able to do."], ["02", "Focused recording", "Keep each video centered on one practical outcome."], ["03", "Useful resources", "Add notes, references, or exercises beside the lesson."], ["04", "Knowledge check", "Finish a module with practice and a short quiz."]].map((item) => (
                <div key={item[0]}><span>{item[0]}</span><p><strong>{item[1]}</strong><small>{item[2]}</small></p></div>
              ))}
            </section>
          </div>

          <section className="library-section">
            <div className="section-heading"><div><span className="eyebrow">Content library</span><h2>Edit or delete uploaded resources</h2></div></div>
            {assets.length ? (
              <div className="asset-table">
                <div className="asset-row asset-header"><span>Content</span><span>Course</span><span>Type</span><span>Size</span><span>Actions</span></div>
                {assets.map((asset) =>
                  editingAssetId === asset._id ? (
                    <form className="asset-edit-row" key={asset._id} onSubmit={updateAsset}>
                      <input type="hidden" name="id" value={asset._id} />
                      <label>Content title<input name="title" defaultValue={asset.title} required /></label>
                      <label>Course<select name="course" defaultValue={asset.course}>{courses.map((course) => <option value={course.slug} key={course.slug}>{course.title}</option>)}</select></label>
                      <div className="management-actions"><button className="primary-small" type="submit">Save</button><button className="text-button" type="button" onClick={() => setEditingAssetId(null)}>Cancel</button></div>
                    </form>
                  ) : (
                    <div className="asset-row" key={asset._id}>
                      <span><i className={asset.kind}>{asset.kind === "video" ? "▶" : "DOC"}</i><strong>{asset.title}</strong></span>
                      <span>{courses.find((c) => c.slug === asset.course)?.title ?? asset.course}</span>
                      <span>{asset.kind}</span><span>{formatBytes(asset.size)}</span>
                      <span className="asset-actions">
                        {asset.url && <a href={asset.url} target="_blank" rel="noreferrer">Open</a>}
                        <button onClick={() => setEditingAssetId(asset._id)}>Edit</button>
                        <button className="danger-link" onClick={() => deleteAsset(asset)}>Delete</button>
                      </span>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="empty-library"><span>□</span><h3>Your library is ready</h3><p>Upload the first recorded lesson or course document to begin.</p></div>
            )}
          </section>

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
                      <span><strong>{authUser.name}</strong><small>{authUser.role} · {authUser.profile?.collegeName ?? "Profile incomplete"}</small></span>
                      <b>{authUser.profile?.complete ? "View" : "Pending"}</b>
                    </button>
                  )) : <div className="empty-state">No student or teacher accounts yet.</div>}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {status && <p className="admin-status" role="status">{status}</p>}
    </div>
  );
}
