/**
 * Login/Landing screen (Design_System.docx §5.5, §6.4). Visual-only: the
 * app has no auth backend yet (Spec §1.1, App.tsx's RequireAuth is a
 * placeholder that always passes), so this screen matches the design
 * reference exactly but doesn't check credentials — submitting goes
 * straight to the Dashboard, the same as any other route today.
 */

import { useNavigate } from "react-router-dom";
import { ROUTE_PATHS } from "../router.js";

export function LoginPage() {
  const navigate = useNavigate();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    navigate(ROUTE_PATHS.dashboard);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse 900px 480px at 50% -8%, color-mix(in srgb, var(--color-accent) 18%, transparent), transparent 70%), var(--color-bg-login)",
        color: "var(--color-text-login)",
        padding: "var(--space-xl)",
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 500, margin: "0 0 var(--space-xl)", letterSpacing: 0.2 }}>Rack-App</h1>

      <form onSubmit={handleSubmit} className="login-form" style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
        <input type="email" placeholder="Email" required className="login-input" />
        <input type="password" placeholder="Password" required className="login-input" />
        <button type="submit" className="btn btn-primary" style={{ height: 36, marginTop: "var(--space-xs)" }}>
          Sign In
        </button>
      </form>
    </div>
  );
}
