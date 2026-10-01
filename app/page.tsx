import CopilotPanel from "@/components/CopilotPanel"
import Dashboard from "@/components/Dashboard"

export default function Home() {
  return (
    <div className="pageWithCopilot">
      <Dashboard/>
      <CopilotPanel/>
    </div>
  )
}
