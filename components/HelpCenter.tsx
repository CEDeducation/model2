import Link from "next/link"

const quickStarts = [
  {
    title: "1. Start in Notebook",
    body: "Create an experiment, set the status, and write your protocol, observations, and results in one place.",
  },
  {
    title: "2. Move to Molecular Biology",
    body: "Import FASTA or GenBank, inspect the plasmid map, review primers, and edit annotations.",
  },
  {
    title: "3. Save evidence",
    body: "Use the Evidence page to search scientific sources and save papers or records that support your work.",
  },
  {
    title: "4. Organize workflows",
    body: "Use Workflows to track tasks, assign priorities, and see what remains open in the lab.",
  },
]

const faqs = [
  ["Where is my data stored?", "OpenLab stores a local working copy in the browser and can sync cloud data to Supabase when you configure cloud mode in Settings."],
  ["Will my work still be there later?", "Yes. Local work remains in browser storage, and cloud-enabled work is restored from Supabase so you can continue where you left off."],
  ["How do I import sequences?", "Open Molecular biology, click Import sequences, and upload FASTA, GenBank, CSV, TSV, JSON, or raw DNA text."],
  ["What happened to Inventory?", "Inventory has been removed from the visible interface so the product feels more focused on research workflows and molecular biology."],
]

export default function HelpCenter() {
  return (
    <div className="pageBody stackPage helpPage">
      <div className="pageHeading">
        <div>
          <div className="sectionEyebrow">HELP CENTER</div>
          <h1>Learn OpenLab quickly</h1>
          <p>This section explains the main product surfaces so students and new lab members can start using the workspace without confusion.</p>
        </div>
      </div>

      <section className="surfaceCard helpHeroCard">
        <div>
          <h2>Recommended path</h2>
          <p>Notebook → Molecular biology → Evidence → Workflows → Settings & sync</p>
        </div>
        <div className="helpHeroActions">
          <Link href="/notebook" className="primaryButton linkButton">Create experiment</Link>
          <Link href="/plasmids" className="ghostButton linkButton">Open plasmid map</Link>
        </div>
      </section>

      <section className="helpGrid">
        {quickStarts.map(item => (
          <article key={item.title} className="surfaceCard helpStepCard hoverLiftCard">
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </article>
        ))}
      </section>

      <section className="surfaceCard faqCard">
        <div className="cardHeader"><div><div className="sectionEyebrow">FAQ</div><h2>Common questions</h2></div></div>
        <div className="faqList">
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
