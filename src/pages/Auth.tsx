import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./AuthPolish.css";
import { Eye, Stethoscope } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Button, Input } from "../components/ui";
import { useNavigation } from "../router";
import { errorMessage, googleSignInUrl, login, register as registerAccount, type Role } from "../api";

const CONDITIONS = ["Diabetes", "Hypertension", "High cholesterol", "Previous eye condition"];

export function Auth() {
  const [register, setRegister] = useState(false);
  const [params] = useSearchParams();
  const [role, setRole] = useState<Role>(params.get("role") === "doctor" ? "doctor" : "patient");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { navigate } = useNavigation();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const str = (k: string) => (f.get(k) as string | null)?.trim() || undefined;
    const num = (k: string) => (str(k) ? Number(str(k)) : undefined);
    setBusy(true); setError(""); setMessage("");
    try {
      const feet = num("height_feet");
      const inches = num("height_inches");
      if (register && role === "patient" && feet === undefined && inches !== undefined) {
        throw new Error("Please enter feet as well as inches, or leave height blank.");
      }
      // Keep metric storage for the existing API, but accept US units in the form.
      const heightCm = feet === undefined
        ? undefined
        : Math.round((feet * 12 + (inches ?? 0)) * 2.54 * 10) / 10;
      const pounds = num("weight_lbs");
      const weightKg = pounds === undefined
        ? undefined
        : Math.round(pounds * 0.45359237 * 10) / 10;
      const user = register
        ? await registerAccount({
            email: str("email")!, password: str("password")!, role, full_name: str("name")!,
            phone: str("phone"), address: str("address"),
            height_cm: heightCm, weight_kg: weightKg,
            conditions: f.getAll("conditions") as string[],
            clinic: str("clinic"), license_number: str("license"),
          })
        : await login(str("email")!, str("password")!, role);
      setMessage(register ? "Account created. Opening your workspace…" : "Signed in. Opening your workspace…");
      window.setTimeout(() => navigate(user.role === "doctor" ? "/doctor" : "/dashboard"), 600);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell tone="vanilla">
      <main className="auth-layout">
        <section className="auth-story">
          <h1>Your eye-health record, connected to the right care.</h1>
          <p>Patients control access. Ophthalmologists only see records shared with them.</p>
          <div className="trust-list"><span><Eye />Retinal history in one place</span><span><Stethoscope />Direct clinician review</span></div>
        </section>
        <section className="auth-panel">
          <fieldset className="auth-frame">
            <legend>Account access</legend>
            <div className="auth-tabs"><button className={!register ? "active" : ""} onClick={() => setRegister(false)}>Sign in</button><button className={register ? "active" : ""} onClick={() => setRegister(true)}>Register</button></div>
            <div className="role-switch"><button className={role === "patient" ? "active" : ""} onClick={() => setRole("patient")}>Patient</button><button className={role === "doctor" ? "active" : ""} onClick={() => setRole("doctor")}>Ophthalmologist</button></div>
            <h2>{register ? `Create ${role} account` : "Welcome back"}</h2>
            <form onSubmit={submit}>
              {register && (
                <>
                  <label>Full name<Input name="name" required /></label>
                  <div className="form-pair"><label>Phone<Input name="phone" type="tel" /></label><label>Address<Input name="address" /></label></div>
                  {role === "patient" ? (
                    <>
                      <div className="oi-measurements-title">Measurements <small>(optional)</small></div>
                      <div className="oi-measurements-grid">
                        <div className="oi-height-field">
                          <span className="oi-field-label">Height</span>
                          <div className="oi-height-pair">
                            <label>Feet<Input name="height_feet" type="number" min={2} max={8} step={1} placeholder="5" /></label>
                            <label>Inches<Input name="height_inches" type="number" min={0} max={11} step={1} placeholder="6" /></label>
                          </div>
                        </div>
                        <label className="oi-weight-field"><span className="oi-field-label">Weight (lbs)</span><Input name="weight_lbs" type="number" min={1} max={1000} step="any" placeholder="150" /></label>
                      </div>
                      <fieldset className="condition-field oi-health-field">
                        <legend>Health history</legend>
                        <div className="oi-health-options">
                          {CONDITIONS.map((x) => (
                            <label className="oi-check-option" key={x}>
                              <input type="checkbox" name="conditions" value={x} />
                              <span>{x}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    </>
                  ) : (
                    <div className="form-pair"><label>Clinic<Input name="clinic" /></label><label>License number<Input name="license" required /></label></div>
                  )}
                </>
              )}
              <label>Email<Input name="email" type="email" required /></label>
              <label>Password<Input name="password" type="password" minLength={8} required /></label>
              {message && <p className="demo-message">{message}</p>}
              {error && <p className="form-error" role="alert">{error}</p>}
              <Button size="lg" type="submit" disabled={busy}>{register ? "Create account" : "Sign in"}</Button>
            </form>
            <div className="or"><span>or</span></div>
            <Button variant="outline" size="lg" className="google-button" onClick={() => { window.location.href = googleSignInUrl(); }}><b>G</b>Continue with Google</Button>
          </fieldset>
        </section>
      </main>
    </AppShell>
  );
}
