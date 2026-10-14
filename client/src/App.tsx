import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import AppLayout from "./components/layout/AppLayout";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="login-shell">
        <div className="login-loading">
          <span className="brand-mark">T</span>
          <p>Preparing your learning workspace…</p>
        </div>
      </main>
    );
  }

  if (!user) return <LoginPage />;

  // Anyone who still has to choose their own password stays on the login
  // screen until they do — this is how a freshly created college admin (or an
  // admin-created teacher/student) sets their private password.
  if (user.mustChangePassword) return <LoginPage />;

  return <AppLayout />;
}
