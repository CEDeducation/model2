import type { ReactNode } from "react"
import Sidebar from "./Sidebar"
import Topbar from "./Topbar"
import PwaRegister from "./PwaRegister"
import CloudAutoSync from "./CloudAutoSync"
import ResumeLocation from "./ResumeLocation"

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <PwaRegister/>
      <CloudAutoSync/>
      <ResumeLocation/>
      <Sidebar/>
      <div className="main">
        <Topbar/>
        <main className="content">{children}</main>
      </div>
    </div>
  )
}
