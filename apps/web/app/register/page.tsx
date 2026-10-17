"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, Sprout } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password, client: "web" }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Registration failed");
      const requestedNext = new URLSearchParams(window.location.search).get("next");
      const next = requestedNext?.startsWith("/") ? requestedNext : "/desk";
      router.replace(next); router.refresh();
    } catch (registrationError) { setError(registrationError instanceof Error ? registrationError.message : "Registration failed"); }
    finally { setLoading(false); }
  }

  return <main className="login-shell"><section className="login-card register-card"><Link className="login-back" href="/"><ArrowLeft /> Back to WIMAX</Link><span className="login-mark"><Sprout /></span><p className="overline">YOUR PRIVATE SPACE</p><h1>Create your WIMAX workspace.</h1><p>Your voice notes, tasks, habits and meetings stay connected to one secure account across web and mobile.</p><form onSubmit={submit}><label htmlFor="register-name">Your name</label><input id="register-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Alex" required minLength={2} /><label htmlFor="register-email">Email</label><input id="register-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /><label htmlFor="register-password">Password</label><input id="register-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} required /><small>At least 10 characters</small><label htmlFor="register-confirm">Confirm password</label><input id="register-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} minLength={10} required /><label className="legal-acceptance" htmlFor="legal-acceptance"><input id="legal-acceptance" type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} required /><span>I agree to the <Link href="/terms" target="_blank">Terms</Link> and acknowledge the <Link href="/privacy" target="_blank">Privacy Policy</Link>, including the rules for lawful meeting recording.</span></label><button disabled={loading || !name || !email || password.length < 10 || password !== confirm || !accepted}>{loading ? <LoaderCircle className="spin" /> : null} Create workspace</button>{error ? <span role="alert">{error}</span> : null}</form><p className="auth-switch">Already have an account? <Link href="/login?next=%2Fdesk">Sign in</Link></p><p className="login-privacy">Password protected · Encrypted session · Device recognition</p></section></main>;
}
