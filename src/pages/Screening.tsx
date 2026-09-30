import { AppShell, PageIntro } from "../components/AppShell";
import { ScanUploader } from "../components/ScanUploader";
export function Analyze(){return <AppShell><main className="page-shell"><PageIntro eyebrow="Image analysis" title="Add retinal photographs" description="Choose a model and upload clear fundus images. Results appear only after you start the analysis."/><ScanUploader/></main></AppShell>}
export function Compare(){return <AppShell><main className="page-shell"><PageIntro eyebrow="Model comparison" title="Compare independent readings" description="Run the same photographs through multiple documented models and review their level of agreement."/><ScanUploader compare/></main></AppShell>}
