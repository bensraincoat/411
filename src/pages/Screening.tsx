import { AppShell, PageIntro } from "../components/AppShell";
import { ScanUploader } from "../components/ScanUploader";
export function Analyze(){return <AppShell><main className="page-shell"><PageIntro eyebrow="Image analysis" title="Add retinal photographs" description="Upload clear retinal photographs for analysis using YOLO. Results appear only after you start the analysis."/><ScanUploader/></main></AppShell>}
