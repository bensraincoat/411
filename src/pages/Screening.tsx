import { AppShell, PageIntro } from "../components/AppShell";
import { ScanUploader } from "../components/ScanUploader";

export function Analyze() {
  return (
    <AppShell>
      <main className="page-shell">
        <PageIntro
          eyebrow="Retinal screening research"
          title="Retinal photograph workspace"
          description="Test YOLO26 Nano on non-identifiable fundus photographs. Predictions are experimental and do not replace an eye examination."
        />
        <ScanUploader />
      </main>
    </AppShell>
  );
}
