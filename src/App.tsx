import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Link } from "./router";
import { Home } from "./pages/Home";
import { Analyze, Compare } from "./pages/Screening";
import { Book } from "./pages/Book";
import { Auth } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { Doctor } from "./pages/Doctor";

const titles: Record<string, string> = {
  "/": "openI — Diabetic Retinopathy Screening Support",
  "/analyze": "Analyze retinal photographs — openI",
  "/compare": "Compare screening models — openI",
  "/book": "Book an appointment — openI",
  "/auth": "Sign in or register — openI",
  "/dashboard": "Patient dashboard — openI",
  "/doctor": "Clinician workspace — openI",
};

function NotFound() {
  return <AppShell><main className="not-found"><div><h1>404</h1><h2>Page not found</h2><p>The page you’re looking for doesn’t exist or has moved.</p><Link className="btn" to="/">Go home</Link></div></main></AppShell>;
}

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => { document.title = titles[pathname] ?? "Page not found — openI"; }, [pathname]);
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/analyze" element={<Analyze />} />
      <Route path="/compare" element={<Compare />} />
      <Route path="/book" element={<Book />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/doctor" element={<Doctor />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
