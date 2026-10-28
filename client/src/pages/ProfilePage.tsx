import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, roleLabel } from "../api/client";
import { useToast } from "../context/ToastContext";
import { INDIA_STATES } from "../data/constants";
import TeacherProfileFields from "../components/profile/TeacherProfileFields";
import StudentProfileFields from "../components/profile/StudentProfileFields";

export default function ProfilePage({ onSaved }: { onSaved: () => void }) {
  const { user, setUser } = useAuth();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const profile = user?.profile;
  const { success, error } = useToast();

  if (!user) return null;

  const isSuperAdmin = user.role === "admin";
  const isCollegeAdmin = user.role === "collegeAdmin";
  const isTeacher = user.role === "teacher";
  const isStudent = !isSuperAdmin && !isCollegeAdmin && !isTeacher;

  if (isSuperAdmin) {
    return (
      <div className="page-content profile-page">
        <section className="admin-profile-card">
          <div className="profile-avatar large">A</div>
          <div>
            <span className="eyebrow accent">Administrator account</span>
            <h1>{user.name}</h1>
            <p>{user.email}</p>
          </div>
        </section>
      </div>
    );
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      collegeName: String(form.get("collegeName") ?? "").trim(),
      department: String(form.get("department") ?? "").trim(),
      state: String(form.get("state") ?? "").trim(),
      city: String(form.get("city") ?? "").trim(),
      pincode: String(form.get("pincode") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      about: String(form.get("about") ?? "").trim(),
    };
    if (isTeacher) {
      payload["designation"] = String(form.get("designation") ?? "").trim();
      payload["qualification"] = String(form.get("qualification") ?? "").trim();
      payload["specialization"] = String(form.get("specialization") ?? "").trim();
      payload["experienceYears"] = String(form.get("experienceYears") ?? "").trim();
    } else if (isStudent) {
      payload["degree"] = String(form.get("degree") ?? "").trim();
      payload["studyYear"] = String(form.get("studyYear") ?? "").trim();
      payload["guardianName"] = String(form.get("guardianName") ?? "").trim();
      payload["guardianPhone"] = String(form.get("guardianPhone") ?? "").trim();
      payload["courseType"] = String(form.get("courseType") ?? "").trim();
    }
    const password = String(form.get("newPassword") ?? "");
    const confirm = String(form.get("confirmPassword") ?? "");
    if (password && password !== confirm) {
      setBusy(false);
      setStatus("The new passwords do not match.");
      error("Save failed", "The new passwords do not match.");
      return;
    }
    if (password) {
      payload["newPassword"] = password;
      payload["currentPassword"] = String(form.get("currentPassword") ?? "");
    }
    try {
      const { user: updated } = await api.updateProfile(payload);
      setUser(updated);
      setStatus("Profile saved successfully.");
      success("Profile saved", "Your profile has been updated successfully.");
      onSaved();
    } catch (err: any) {
      const msg = err?.message ?? "Unable to save your profile.";
      setStatus(msg);
      error("Save failed", msg);
    } finally {
      setBusy(false);
    }
  }

  const lockedCollegeName = user.collegeNameLocked ? (user.profile?.collegeName ?? "") : "";
  const department = isCollegeAdmin
    ? profile?.department ?? ""
    : user.department || profile?.department || "";

  return (
    <div className="page-content profile-page">
      <form className="profile-form-card" onSubmit={handleSave}>
        <div className="profile-form-head">
          <div className="profile-avatar large">{profile?.photoUrl ? <img src={profile.photoUrl} alt="Profile" /> : user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}</div>
          <div>
            <span className="eyebrow accent">{isCollegeAdmin ? "College administrator profile" : "Account profile"}</span>
            <h1>{user.name}</h1>
            <p className="profile-identity"><span>{roleLabel(user.role)}</span><span>{user.email}</span>{department && <span>Dept: {department}</span>}</p>
          </div>
        </div>
        <section className="profile-form-section">
          <h2>Change password (optional)</h2>
          <div className="form-row">
            <label>Current password<input name="currentPassword" type="password" placeholder="Required to set a new password" /></label>
            <label>New password<input name="newPassword" type="password" minLength={10} placeholder="Leave blank to keep current password" /></label>
            <label>Confirm new password<input name="confirmPassword" type="password" minLength={10} placeholder="Enter it again" /></label>
          </div>
        </section>
        <section className="profile-form-section">
          <h2>Account</h2>
          <div className="form-row">
            <label>Email address<input value={user.email} readOnly className="locked-profile-field" aria-label="Email address" /></label>
            <label>Role<input value={roleLabel(user.role)} readOnly className="locked-profile-field" aria-label="Role" /></label>
          </div>
        </section>
        <section className="profile-form-section">
          <h2>College details</h2>
          <div className="form-row">
            <label>College name<input className={lockedCollegeName ? "locked-profile-field" : ""} name="collegeName" required readOnly={Boolean(lockedCollegeName)} defaultValue={lockedCollegeName || profile?.collegeName} placeholder="College or university" /></label>
            {isCollegeAdmin ? (
              <label>Department<input name="department" defaultValue={department} placeholder="e.g. Administration (optional)" /></label>
            ) : (
              <label>Department<input value={department} readOnly className="locked-profile-field" aria-label="Department" title="Set by your college administrator" placeholder="Assigned by your college admin" /></label>
            )}
          </div>
        </section>
        {isTeacher && <TeacherProfileFields details={profile?.teacher} />}
        {isStudent && <StudentProfileFields details={profile?.student} />}
        <section className="profile-form-section">
          <h2>College location and contact</h2>
          <div className="form-row">
            <label>State<select name="state" required defaultValue={profile?.state ?? ""}><option value="" disabled>Select state</option>{INDIA_STATES.map((state) => <option key={state}>{state}</option>)}</select></label>
            <label>City<input name="city" required defaultValue={profile?.city} placeholder="College city" /></label>
          </div>
          <div className="form-row">
            <label>PIN code<input name="pincode" inputMode="numeric" pattern="[0-9]{6}" defaultValue={profile?.pincode} placeholder="6-digit PIN code" /></label>
            <label>Phone number<input name="phone" type="tel" inputMode="numeric" pattern="[0-9+\-\s()]{7,15}" required defaultValue={profile?.phone} placeholder="Contact number (numbers only)" /></label>
          </div>
        </section>
        <section className="profile-form-section">
          <h2>About you</h2>
          <label>About<textarea name="about" defaultValue={profile?.about} placeholder="Your interests, skills, and career goals" /></label>
        </section>
        {status && <p className="profile-status" role="status">{status}</p>}
        <div className="profile-form-actions">
          <button className="text-button" type="button" onClick={onSaved}>Cancel</button>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save profile <span>→</span>"}
          </button>
        </div>
      </form>
    </div>
  );
}
