import Link from "next/link";
import { ArrowLeft, Bell, ShieldCheck, Smartphone, Sprout } from "lucide-react";

export const metadata = { title: "WIMAX for iOS" };

export default function IosDownloadPage() {
  return <main className="ios-status-shell"><section className="ios-status-card"><Link href="/#apps"><ArrowLeft /> Back to apps</Link><span className="ios-status-mark"><Sprout /></span><h1>WIMAX for iOS.</h1><p>The native iPhone build is being prepared for TestFlight. We will only publish a download link after Apple signing and device acceptance are complete.</p><div><Smartphone /><span><strong>Native voice capture</strong><small>iPhone, widgets and App Intents</small></span></div><div><ShieldCheck /><span><strong>Private by default</strong><small>Secure session and encrypted transport</small></span></div><div><Bell /><span><strong>TestFlight link coming next</strong><small>No fake or unsigned download is offered here</small></span></div><Link className="landing-primary" href="/login?next=%2Fdesk">Use the web app now</Link></section></main>;
}
