import { AppShell } from "../components/AppShell";
import { ScanUploader } from "../components/ScanUploader";

export function Analyze() {
  return (
    <AppShell>
      <main className="portal-shell dash">
        <header className="dash-head">
          <div>
            <span className="dash-role">Research workspace</span>
            <h1>Retinal screening</h1>
          </div>
        </header>

        <ScanUploader />
      </main>
    </AppShell>
  );
}
