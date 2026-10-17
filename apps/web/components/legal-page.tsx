import Link from "next/link";
import { ArrowLeft, ShieldCheck, Sprout } from "lucide-react";

export type LegalSection = { title: string; paragraphs: string[]; bullets?: string[] };

export function LegalPage({ title, summary, sections }: { title: string; summary: string; sections: LegalSection[] }) {
  return <main className="legal-shell">
    <header className="legal-nav"><Link className="landing-brand" href="/"><Sprout /> WIMAX</Link><nav><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms</Link><Link href="/login?next=%2Fdesk">Sign in</Link></nav></header>
    <article className="legal-document">
      <Link className="legal-back" href="/"><ArrowLeft /> Back to WIMAX</Link>
      <div className="legal-heading"><span><ShieldCheck /></span><div><p className="overline">LEGAL · DRAFT FOR REVIEW</p><h1>{title}</h1><p>{summary}</p><small>Effective date: 25 August 2026 · Last updated: 25 August 2026</small></div></div>
      <aside><strong>Important</strong><p>This is a practical launch template, not legal advice. It must be reviewed and adapted by qualified counsel for the countries where WIMAX and its users operate.</p></aside>
      <div className="legal-sections">{sections.map((section, index) => <section id={`section-${index + 1}`} key={section.title}><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.bullets ? <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}</div></section>)}</div>
    </article>
    <footer className="legal-footer"><span>© {new Date().getFullYear()} wimax.ai</span><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></footer>
  </main>;
}
