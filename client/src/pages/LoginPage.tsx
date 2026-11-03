import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { usePopup } from "../context/PopupContext";

export default function LoginPage() {
  const { user, login, completePassword } = useAuth();
  const { success, error: showError } = usePopup();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const needsOnboarding = user?.mustChangePassword === true;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login(email, password);
    } catch (err) {
      showError("Sign-in failed", err instanceof Error ? err.message : "Unable to sign in.");
    }
  }

  async function handleCompletePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showError("Save failed", "The new passwords do not match.");
      return;
    }
    try {
      await completePassword(newPassword);
      success("Password saved", "Your private password is set. Welcome to TarasLearn.");
    } catch (err) {
      showError("Save failed", err instanceof Error ? err.message : "Unable to change the password.");
    }
  }

  if (needsOnboarding) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <form className="login-form" onSubmit={handleCompletePassword}>
            <span className="eyebrow accent">Password required</span>
            <h2>Create your private password</h2>
            <p>Use at least 10 characters.</p>
            <label>
              New password
              <input type="password" minLength={10} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </label>
            <label>
              Confirm password
              <input type="password" minLength={10} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </label>
            <button className="primary-button" type="submit">Change password <span>→</span></button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="login-shell">
      <section className="login-story">
        <div className="login-brand">
          <span className="brand-mark">T</span>
          <strong>Taras<span>Learn</span></strong>
        </div>
        <div>
          <span className="eyebrow">Engineering learning platform</span>
          <h1>Learn deeply.<br />Build confidently.</h1>
          <p>Recorded courses, practical documents, quizzes, and hands-on coding—organized for every engineering pathway.</p>
        </div>
        <small>Designed for focused technical learning.</small>
      </section>
      <section className="login-panel">
        <form className="login-form" onSubmit={handleSubmit}>
          <span className="eyebrow accent">Welcome back</span>
          <h2>Sign in to continue</h2>
          <p>Sign in as an administrator, teacher, or student.</p>
          <label>
            Email address
            <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </label>
          <label>
            Password
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />
          </label>
          <button className="primary-button" type="submit">Sign in <span>→</span></button>
        </form>
      </section>
    </main>
  );
}
