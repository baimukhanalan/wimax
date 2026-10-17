"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Check, LoaderCircle, Sprout } from "lucide-react";

export default function LoginPage() {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [remembered, setRemembered] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void fetch("/api/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setRemembered(Boolean(payload.remembered)))
      .catch(() => setRemembered(false));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError(null);
    try {
      const response = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account, password }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Sign in failed");
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.assign(next?.startsWith("/") ? next : "/desk");
    } catch (loginError) { setError(loginError instanceof Error ? loginError.message : "Sign in failed"); }
    finally { setLoading(false); }
  }
  const ready = remembered !== null;
  return <main className="login-shell"><section className="login-card"><Link className="login-back" href="/"><ArrowLeft /> Back to WIMAX</Link><span className="login-mark"><Sprout /></span>{remembered ? <p className="recognized-device"><Check /> Recognized device</p> : <p className="overline">PRIVATE WORKSPACE</p>}<h1>{remembered ? "Welcome back." : "Open WIMAX."}</h1><p>{remembered ? "We remember this device. Enter your password to continue." : "Sign in once with your email or account and password. Next time, this device will only ask for your password."}</p><form onSubmit={submit}>{!remembered ? <><label htmlFor="mirror-account">Email or WIMAX account</label><input id="mirror-account" type="text" autoComplete="username" value={account} onChange={(event) => setAccount(event.target.value)} placeholder="you@example.com" autoFocus required /></> : null}<label htmlFor="mirror-password">Password</label><input id="mirror-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus={remembered === true} required /><button disabled={!ready || loading || !password || (!remembered && !account)}>{loading || !ready ? <LoaderCircle className="spin" /> : null} Open WIMAX</button>{error ? <span role="alert">{error}</span> : null}</form>{!remembered ? <p className="auth-switch">New to WIMAX? <Link href="/register?next=%2Fdesk">Create an account</Link></p> : null}<p className="login-privacy">Encrypted session · HttpOnly cookies · No password stored on device</p></section></main>;
}
