import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Delete your WIMAX account",
  description: "How to permanently delete a WIMAX account and its associated data.",
};

export default function AccountDeletionPage() {
  return <main className="legal-page"><article className="legal-document"><p className="legal-kicker">ACCOUNT & DATA CONTROL</p><h1>Delete your WIMAX account</h1><p className="legal-summary">You can permanently delete your account from WIMAX on mobile or on the web. You do not need to contact support.</p><section><h2>In the mobile app</h2><ol><li>Open WIMAX and tap the Settings icon.</li><li>Open “Delete account”.</li><li>Enter your current password, type DELETE and confirm.</li></ol></section><section><h2>In the web app</h2><ol><li>Sign in and open Settings.</li><li>Scroll to “Delete account”.</li><li>Enter your current password, type DELETE and confirm.</li></ol></section><section><h2>What is deleted</h2><p>Your account, voice captures stored by WIMAX, meeting uploads, transcripts, tasks, habits, knowledge pages, financial entries, commands, integrations, push tokens and derived analytics are removed from the active service. Limited encrypted backups or records required for security, fraud prevention, disputes or law may remain for a short, documented retention period before deletion.</p></section><section><h2>Before deleting</h2><p>Export your structured workspace from Settings if you want a copy. Account deletion cannot be undone.</p></section><div className="legal-back"><Link href="/privacy">Read the Privacy Policy</Link><Link href="/login">Open WIMAX</Link></div></article></main>;
}
