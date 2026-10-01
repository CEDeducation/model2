import CopilotPanel from "@/components/CopilotPanel"
import NotebookWorkspace from "@/components/NotebookWorkspace"

export default function NotebookPage() {
  return (
    <div className="pageWithCopilot">
      <div className="pageBody notebookPage">
        <div className="pageHeading compact">
          <div><div className="sectionEyebrow">EXPERIMENT NOTEBOOK</div><h1>Notebook</h1><p>A focused writing surface for experiment context, procedure, observations, and deviations.</p></div>
        </div>
        <NotebookWorkspace/>
      </div>
      <CopilotPanel/>
    </div>
  )
}
