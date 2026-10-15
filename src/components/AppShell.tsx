import {
  CalendarDays,
  LayoutDashboard,
  LogIn,
  LogOut
} from "lucide-react";

import { useEffect, useState, type ReactNode } from "react";
import { Link } from "../router";
import { apiRequest } from "../api/client";
import type { User } from "../api/types";
import { logout } from "../api";


export function EyeMark({
  compact = false
}: {
  compact?: boolean;
}) {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 64 44" role="img">
        <path d="M3 22C10 9 20 3 32 3s22 6 29 19c-7 13-17 19-29 19S10 35 3 22Z" />
        <circle cx="32" cy="22" r="10" />
        <circle cx="32" cy="22" r="3.5" />
        <path d="M14 7 9 2M50 7l5-5M14 37l-5 5M50 37l5 5" />
      </svg>

      {!compact && <strong>openI</strong>}
    </span>
  );
}


export function AppShell({
  children,
  tone = "plain"
}: {
  children: ReactNode;
  tone?: "plain" | "vanilla";
}) {
  const signedIn = Boolean(
    localStorage.getItem("openi.token")
  );

  // Resolve the authenticated account role from Flask, not a guess or URL.
  const [portalRole, setPortalRole] = useState<"patient" | "doctor" | null>(null);
  useEffect(() => {
    if (!signedIn) {
      setPortalRole(null);
      return;
    }
    let active = true;
    apiRequest<User>("/api/auth/me")
      .then((user) => {
        if (!active) return;
        setPortalRole(user.role === "doctor" || user.role === "patient" ? user.role : null);
      })
      .catch(() => {
        if (active) setPortalRole(null);
      });
    return () => { active = false; };
  }, [signedIn]);

  async function handleLogout() {
    await logout();

    // Return to the homepage after signing out.
    window.location.href = "/";
  }

  return (
    <div
      className={`min-h-screen ${
        tone === "vanilla" ? "shell-vanilla" : ""
      }`}
    >
      <header className="site-header">
        <div className="site-nav">
          <Link
            to="/"
            className="brand-link"
            aria-label="openI home"
          >
            <EyeMark />
          </Link>

          {!signedIn && (
            <nav aria-label="Primary navigation" className="nav-links">
              <Link to="/">Home</Link>
              <Link to="/analyze">Screening</Link>
            </nav>
          )}

          <div className="nav-actions">
            {!signedIn && (
              <Link to="/book" className="btn btn-ghost btn-sm header-booking">
                <CalendarDays /> Book an appointment
              </Link>
            )}

            {signedIn && portalRole && (
              <Link
                to={portalRole === "doctor" ? "/doctor" : "/dashboard"}
                className="btn btn-ghost btn-sm openi-portal-shortcut"
                aria-label={portalRole === "doctor" ? "Doctor portal" : "Patient portal"}
              >
                <LayoutDashboard />
                <span>My portal</span>
              </Link>
            )}
            {signedIn ? (
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleLogout}
              >
                <LogOut />
                Sign out
              </button>
            ) : (
              <Link
                to="/auth"
                className="btn btn-sm"
              >
                <LogIn />
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {children}

      <footer className="site-footer">
        <EyeMark compact />

        <p>
          Screening support for diabetic retinopathy.
          Not a medical diagnosis.
        </p>

        {/* Portal entry points belong on the public homepage, not every page. */}
      </footer>
    </div>
  );
}


export function PageIntro({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
}) {
  return (
    <div className="page-intro">
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}