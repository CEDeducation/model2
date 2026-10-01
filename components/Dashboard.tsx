"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { storage } from "@/lib/storage"
import type { WorkspaceState } from "@/lib/types"
import { ActivityIcon, BookIcon, DnaIcon, FolderIcon, HelpIcon, RegistryIcon, SparkIcon, WorkflowIcon } from "./Icons"

const solutionCards = [
  {
    href: "/notebook",
    eyebrow: "BIORESEARCH",
    title: "Bioresearch workspace",
    body: "Plan experiments, document assays, link data to projects, and keep sequence work connected to evidence.",
  },
  {
    href: "/workflows",
    eyebrow: "BIOPROCESS",
    title: "Bioprocess operations",
    body: "Turn recurring lab work into structured queues, review checkpoints, and track progress from request to delivery.",
  },
  {
    href: "/workflows",
    eyebrow: "AUTOMATION",
    title: "Automation-ready steps",
    body: "Standardize protocols, define handoff rules, and prepare methods that can later connect to instruments or scripts.",
  },
  {
    href: "/projects",
    eyebrow: "IN VIVO",
    title: "In vivo study tracking",
    body: "Organize study design, cohorts, schedules, observations, and linked records in one shared workspace.",
  },
]

export default function Dashboard() {
  const [state, setState] = useState<WorkspaceState | null>(null)

  useEffect(() => {
    const refresh = () => setState(storage.getState())
    refresh()
    window.addEventListener(storage.eventName, refresh)
    return () => window.removeEventListener(storage.eventName, refresh)
  }, [])

  const stats = useMemo(() => {
    if (!state) return { projects: 0, notebook: 0, registry: 0, sequences: 0, tasks: 0, evidence: 0 }
    return {
      projects: state.projects.filter(item => item.status === "Active").length,
      notebook: state.notebook.length,
      registry: state.registry.length,
      sequences: state.sequences.length,
      tasks: state.tasks.filter(item => item.status !== "Done").length,
      evidence: state.sources.length,
    }
  }, [state])

  return (
    <div className="dashboardPage">
      <div className="pageHeading dashboardHeading modernHeroHeading">
        <div>
          <div className="sectionEyebrow">OPENLAB · RESEARCH OPERATING SYSTEM</div>
          <h1>Modern lab work, without the lifeless UI.</h1>
          <p>OpenLab now focuses on a cleaner research workflow: notebook, molecular biology, registry, workflows, evidence, and guided help. The interface is larger, clearer, and easier to learn.</p>
        </div>
        <div className="heroActionRow">
          <Link href="/notebook" className="primaryButton linkButton">+ New experiment</Link>
          <Link href="/help" className="ghostButton linkButton">Open help center</Link>
        </div>
      </div>

      <div className="metricGrid metricGridSix">
        <Link href="/projects" className="metricCard hoverLiftCard"><div className="metricIcon"><FolderIcon size={19}/></div><div><span>Active projects</span><strong>{stats.projects}</strong></div></Link>
        <Link href="/notebook" className="metricCard hoverLiftCard"><div className="metricIcon"><BookIcon size={19}/></div><div><span>Experiments</span><strong>{stats.notebook}</strong></div></Link>
        <Link href="/registry" className="metricCard hoverLiftCard"><div className="metricIcon"><RegistryIcon size={19}/></div><div><span>Registry entities</span><strong>{stats.registry}</strong></div></Link>
        <Link href="/plasmids" className="metricCard hoverLiftCard"><div className="metricIcon"><DnaIcon size={19}/></div><div><span>Sequences</span><strong>{stats.sequences}</strong></div></Link>
        <Link href="/sources" className="metricCard hoverLiftCard"><div className="metricIcon"><SparkIcon size={19}/></div><div><span>Evidence sources</span><strong>{stats.evidence}</strong></div></Link>
        <Link href="/workflows" className="metricCard hoverLiftCard"><div className="metricIcon"><WorkflowIcon size={19}/></div><div><span>Open tasks</span><strong>{stats.tasks}</strong></div></Link>
      </div>

      <section className="surfaceCard platformFeatureCard">
        <div className="cardHeader">
          <div>
            <div className="sectionEyebrow">VISIBLE PLATFORM MODULES</div>
            <h2>Four expansion areas inspired by modern biotech software</h2>
            <p>These are organized as visible OpenLab product modules rather than exact copies. They make the platform feel broader and closer to a real lab operating system.</p>
          </div>
          <Link href="/platform" className="textLink">See platform overview →</Link>
        </div>
        <div className="platformCardGrid">
          {solutionCards.map(card => (
            <Link href={card.href} key={card.title} className="platformCard hoverLiftCard">
              <span>{card.eyebrow}</span>
              <strong>{card.title}</strong>
              <p>{card.body}</p>
              <b>Open module →</b>
            </Link>
          ))}
        </div>
      </section>

      <div className="dashboardGrid dashboardGridWide">
        <section className="surfaceCard workbenchCard">
          <div className="cardHeader"><div><div className="sectionEyebrow">CORE WORKSPACES</div><h2>Move from idea to result without breaking context</h2><p>Every workspace writes to the same local-first data model and can sync to Supabase when cloud mode is enabled.</p></div></div>
          <div className="launchGrid">
            <Link href="/notebook" className="launchItem"><div className="launchIcon"><BookIcon size={20}/></div><div><strong>Notebook</strong><span>Structured experiment records, project links, status, tags, attachments and linked registry entities.</span></div><b>→</b></Link>
            <Link href="/plasmids" className="launchItem"><div className="launchIcon"><DnaIcon size={20}/></div><div><strong>Molecular biology</strong><span>FASTA/GenBank import, circular maps, features, primers, ORFs, restriction analysis and PCR checks.</span></div><b>→</b></Link>
            <Link href="/registry" className="launchItem"><div className="launchIcon"><RegistryIcon size={20}/></div><div><strong>Registry</strong><span>Track DNA, RNA, proteins, cell lines, compounds, samples and lineage.</span></div><b>→</b></Link>
            <Link href="/sources" className="launchItem"><div className="launchIcon"><SparkIcon size={20}/></div><div><strong>Evidence</strong><span>Search scientific databases, save source records, and cite evidence in the scientific sandbox copilot.</span></div><b>→</b></Link>
          </div>
        </section>

        <section className="surfaceCard healthCard">
          <div className="cardHeader"><div><div className="sectionEyebrow">WORKSPACE HEALTH</div><h2>Things needing attention</h2></div><Link href="/help" className="textLink">How to use OpenLab →</Link></div>
          <div className="healthRows">
            <div className="healthRow"><div className="healthIcon"><WorkflowIcon size={17}/></div><div><strong>{stats.tasks} open workflow tasks</strong><span>Backlog, ready, in-progress or blocked work that still needs action.</span></div></div>
            <div className="healthRow"><div className="healthIcon"><ActivityIcon size={17}/></div><div><strong>{state?.audit.length || 0} tracked local events</strong><span>Recent record creation, edits and deletions are kept in the activity log.</span></div></div>
            <div className="healthRow"><div className="healthIcon"><HelpIcon size={17}/></div><div><strong>Help center included</strong><span>New guided help makes onboarding easier for students and new lab members.</span></div></div>
          </div>
          <div className="productionNote">Inventory has been removed from the visible product surface. OpenLab is now centered around documentation, molecular biology, registry, workflows, evidence, and guidance.</div>
        </section>
      </div>
    </div>
  )
}
