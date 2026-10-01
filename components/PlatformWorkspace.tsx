import Link from "next/link"
import { DnaIcon, WorkflowIcon, SparkIcon, FolderIcon } from "./Icons"

const modules = [
  {
    eyebrow: "BIORESEARCH",
    title: "Bioresearch workspace",
    description: "Designed for day-to-day research: experiments, sequences, registry links, and source-backed scientific notes.",
    bullets: ["Notebook-linked experiment records", "Sequence and primer workbench", "Registry-connected context"],
    href: "/notebook",
    icon: DnaIcon,
  },
  {
    eyebrow: "BIOPROCESS",
    title: "Bioprocess operations",
    description: "A process-oriented layer for teams that need structured execution, review checkpoints, and repeatable operational flow.",
    bullets: ["Stage-based workflow tracking", "Project status visibility", "Reusable operations structure"],
    href: "/workflows",
    icon: WorkflowIcon,
  },
  {
    eyebrow: "AUTOMATION",
    title: "Automation-ready methods",
    description: "Prepare lab methods and repetitive tasks so they can later connect to scripts, liquid handlers, or future automation endpoints.",
    bullets: ["Protocol standardization", "Actionable step design", "Future API/instrument integration path"],
    href: "/protocols",
    icon: SparkIcon,
  },
  {
    eyebrow: "IN VIVO",
    title: "In vivo study planning",
    description: "Use project and workflow primitives to manage cohort-based studies, schedules, observations, and linked documentation.",
    bullets: ["Study planning", "Observation logging", "Project-centric collaboration"],
    href: "/projects",
    icon: FolderIcon,
  },
]

export default function PlatformWorkspace() {
  return (
    <div className="pageBody stackPage">
      <div className="pageHeading">
        <div>
          <div className="sectionEyebrow">OPENLAB PLATFORM</div>
          <h1>Visible product modules</h1>
          <p>OpenLab now exposes four product-style modules so the platform feels broader and more intentional: bioresearch, bioprocess, automation, and in vivo study support.</p>
        </div>
      </div>

      <section className="surfaceCard platformOverviewCard">
        <div className="platformCardGrid">
          {modules.map(module => {
            const Icon = module.icon
            return (
              <div className="platformCard platformCardLarge" key={module.title}>
                <div className="platformCardIcon"><Icon size={22}/></div>
                <span>{module.eyebrow}</span>
                <strong>{module.title}</strong>
                <p>{module.description}</p>
                <ul>
                  {module.bullets.map(item => <li key={item}>{item}</li>)}
                </ul>
                <Link href={module.href} className="ghostButton linkButton">Open module</Link>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
