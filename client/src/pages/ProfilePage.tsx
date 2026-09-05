import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { INDIA_STATES } from "../data/constants";

export default function ProfilePage({ onSaved }: { onSaved: () => void }) {
  const { user, setUser } = useAuth();
  const [status, setStatus] = useState("");
  const profile = user?.profile;

  if (!user) return null;

  const isAdmin = user.role === "admin";
  if (isAdmin) {
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
    setStatus("Saving your profile…");
    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      collegeName: String(form.get("collegeName") ?? "").trim(),
      department: String(form.get("department") ?? "").trim(),
      degree: String(form.get("degree") ?? "").trim(),
      studyYear: String(form.get("studyYear") ?? "").trim(),
      state: String(form.get("state") ?? "").trim(),
      city: String(form.get("city") ?? "").trim(),
      pincode: String(form.get("pincode") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      about: String(form.get("about") ?? "").trim(),
    };
    const password = String(form.get("newPassword") ?? "");
    const confirm = String(form.get("confirmPassword") ?? "");
    if (password && password !== confirm) {
      setStatus("The new passwords do not match.");
      return;
    }
    if (password) payload["newPassword"] = password;
    try {
      const { user: updated } = await api.updateProfile(payload);
      setUser(updated);
      setStatus("Profile saved successfully.");
      onSaved();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Unable to save your profile.");
    }
  }

  const lockedCollegeName = user.collegeNameLocked && user.collegeName ? user.collegeName : "";

  return (
    <div className="page-content profile-page">
      <form className="profile-form-card" onSubmit={handleSave}>
        <div className="profile-form-head">
          <div className="profile-avatar large">{profile?.photoUrl ? <img src={profile.photoUrl} alt="Profile" /> : user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}</div>
          <div><span className="eyebrow accent">Account profile</span><h1>{user.name}</h1><p>Keep your college, contact, and profile information current.</p></div>
        </div>
        <section className="profile-form-section">
          <h2>Change password (optional)</h2>
          <div className="form-row">
            <label>New password<input name="newPassword" type="password" minLength={10} placeholder="Leave blank to keep current password" /></label>
            <label>Confirm new password<input name="confirmPassword" type="password" minLength={10} placeholder="Enter it again" /></label>
          </div>
        </section>
        <section className="profile-form-section">
          <h2>College details</h2>
          <div className="form-row">
            <label>College name<input className={lockedCollegeName ? "locked-profile-field" : ""} name="collegeName" required readOnly={Boolean(lockedCollegeName)} defaultValue={lockedCollegeName || profile?.collegeName} placeholder="College or university" /></label>
            <label>Department<input name="department" required defaultValue={profile?.department ?? user.department} placeholder="e.g. Computer Science" /></label>
          </div>
          <div className="form-row">
            <label>Degree / program<input name="degree" defaultValue={profile?.degree} placeholder="e.g. B.Tech" /></label>
            <label>Current year<select name="studyYear" defaultValue={profile?.studyYear ?? "1st Year"}><option>1st Year</option><option>2nd Year</option><option>3rd Year</option><option>4th Year</option><option>Graduate</option><option>Faculty</option></select></label>
          </div>
        </section>
        <section className="profile-form-section">
          <h2>College location and contact</h2>
          <div className="form-row">
            <label>State<select name="state" required defaultValue={profile?.state ?? ""}><option value="" disabled>Select state</option>{INDIA_STATES.map((state) => <option key={state}>{state}</option>)}</select></label>
            <label>City<input name="city" required defaultValue={profile?.city} placeholder="College city" /></label>
          </div>
          <div className="form-row">
            <label>PIN code<input name="pincode" inputMode="numeric" pattern="[0-9]{6}" defaultValue={profile?.pincode} placeholder="6-digit PIN code" /></label>
            <label>Phone number<input name="phone" type="tel" required defaultValue={profile?.phone} placeholder="Contact number" /></label>
          </div>
        </section>
        <section className="profile-form-section">
          <h2>About you</h2>
          <label>About<textarea name="about" defaultValue={profile?.about} placeholder="Your interests, skills, and career goals" /></label>
        </section>
        {status && <p className="profile-status" role="status">{status}</p>}
        <div className="profile-form-actions">
          <button className="text-button" type="button" onClick={onSaved}>Cancel</button>
          <button className="primary-button" type="submit">Save profile <span>→</span></button>
        </div>
      </form>
    </div>
  );
}
