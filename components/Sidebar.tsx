"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { getActiveLabSession, labSessionEvent } from "@/lib/lab-session"
import {
  ActivityIcon,
  BookIcon,
  CloudIcon,
  DatabaseIcon,
  DnaIcon,
  FlaskIcon,
  FolderIcon,
  HomeIcon,
  RegistryIcon,
  SettingsIcon,
  WorkflowIcon,
  HelpIcon,
  SparkIcon,
} from "./Icons"

const workspaceItems = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/platform", label: "Platform", icon: SparkIcon },
  { href: "/projects", label: "Projects", icon: FolderIcon },
  { href: "/notebook", label: "Notebook", icon: BookIcon },
  { href: "/protocols", label: "Protocols", icon: FlaskIcon },
  { href: "/registry", label: "Registry", icon: RegistryIcon },
  { href: "/plasmids", label: "Molecular biology", icon: DnaIcon },
  { href: "/workflows", label: "Workflows", icon: WorkflowIcon },
]

const systemItems = [
  { href: "/sources", label: "Evidence", icon: DatabaseIcon },
  { href: "/activity", label: "Activity", icon: ActivityIcon },
  { href: "/help", label: "Help", icon: HelpIcon },
  { href: "/settings", label: "Settings & sync", icon: SettingsIcon },
]

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2) || "OL").toUpperCase()
}

export default function Sidebar() {
  const pathname = usePathname()
  const [workspaceName, setWorkspaceName] = useState("My Lab")
  const [profileName, setProfileName] = useState("Researcher")
  const [profileColor, setProfileColor] = useState("#2d6f63")

  useEffect(() => {
    const rebuild = () => {
      const lab = getActiveLabSession()
      if (!lab) return
      setWorkspaceName(lab.workspaceName)
      setProfileName(lab.profile.displayName)
      setProfileColor(lab.profile.avatarColor)
    }
    rebuild()
    window.addEventListener(labSessionEvent, rebuild)
    return () => window.removeEventListener(labSessionEvent, rebuild)
  }, [])

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brandMark">OL</div>
        <div>
          <strong>OpenLab</strong>
          <span>Research operating system</span>
        </div>
      </div>

      <div className="workspaceSwitcher">
        <div className="avatar" style={{ background: profileColor }}>{initials(profileName)}</div>
        <div><strong>{workspaceName}</strong><span>{profileName}</span></div>
        <span className="switchChevron">⌄</span>
      </div>

      <nav className="nav" aria-label="Workspace navigation">
        <div className="navLabel">Research</div>
        {workspaceItems.map(({ href, label, icon: Icon }) => (
          <Link className={`navItem ${pathname === href ? "active" : ""}`} href={href} key={href}>
            <Icon size={18}/><span>{label}</span>
          </Link>
        ))}
        <div className="navLabel navLabelGap">System</div>
        {systemItems.map(({ href, label, icon: Icon }) => (
          <Link className={`navItem ${pathname === href ? "active" : ""}`} href={href} key={href}>
            <Icon size={18}/><span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebarBottom">
        <Link href="/settings" className="sandboxBadge syncBadge"><CloudIcon size={16}/><span>Persistence</span><b>Auto-save enabled</b></Link>
        <div className="demoNotice"><span className="demoDot"/>Research is saved as you work</div>
      </div>
    </aside>
  )
}
