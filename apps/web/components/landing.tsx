"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { LandingMotion } from "./landing-motion";
import {
  ArrowDown, ArrowRight, AudioLines, BookOpen, Brain, CalendarDays, Check, CheckCircle2,
  Cloud, Download, Fingerprint, HeartPulse, Lightbulb, ListChecks, LockKeyhole, Mic,
  Network, Play, Search, ShieldCheck, Smartphone, Sparkles, Sprout, WalletCards,
} from "lucide-react";
import { LanguageMenu, useLocale } from "./locale";

const flow = [
  { icon: Mic, title: "Speak naturally", copy: "Share a thought, task or meeting out loud." },
  { icon: Sparkles, title: "WIMAX processes", copy: "Context, intent and dates are understood." },
  { icon: ListChecks, title: "Structured output", copy: "Tasks, habits, ideas and records appear." },
  { icon: BookOpen, title: "Connected knowledge", copy: "Every new thought stays in context." },
];

const privacy = [
  { icon: LockKeyhole, title: "Encrypted audio", copy: "Protected in transit and at rest." },
  { icon: Cloud, title: "Local or cloud", copy: "Choose privacy or maximum accuracy." },
  { icon: Fingerprint, title: "You own your data", copy: "Export or delete your WIMAX data anytime." },
  { icon: ShieldCheck, title: "Private by default", copy: "No ads. No attention economy." },
];

const journey = [
  { number: "01", icon: Mic, title: "Start with your voice", lead: "No template. No category picker.", copy: "Say the thought exactly as it arrives. WIMAX keeps the original context while removing filler and repetition.", meta: ["Voice notes", "Quick capture", "Imported audio"] },
  { number: "02", icon: Brain, title: "Let WIMAX understand", lead: "One recording can become many useful things.", copy: "The AI separates tasks, habits, ideas, expenses and reflections, then resolves dates and projects automatically.", meta: ["Intent detection", "Dates and priority", "Speaker chapters"] },
  { number: "03", icon: ListChecks, title: "Leave with a clear next step", lead: "Structure appears without admin work.", copy: "Tasks land in your plan, habits update their history and decisions remain attached to the source audio.", meta: ["Today plan", "Habit history", "Action items"] },
  { number: "04", icon: Network, title: "Build a connected memory", lead: "Your past thoughts stay available.", copy: "WIMAX links related notes and meetings, so a question from months ago can return with its source and unfinished work.", meta: ["Semantic links", "Voice search", "Source audio"] },
  { number: "05", icon: HeartPulse, title: "Notice the patterns", lead: "Your week becomes a story you can act on.", copy: "Energy, routines and recurring pressure turn into a private briefing with practical, non-diagnostic coaching.", meta: ["Energy trends", "Weekly briefing", "Gentle coaching"] },
];

const useCases = [
  { icon: AudioLines, title: "A thought on the move", copy: "Capture it before it disappears. WIMAX turns it into an idea, task or journal entry." },
  { icon: CalendarDays, title: "A one-hour meeting", copy: "Keep chapters, speakers, decisions and follow-ups in one recoverable recording." },
  { icon: Search, title: "A question from two months ago", copy: "Ask naturally and return to the exact note, transcript and work that remained open." },
];

export function Landing() {
  const { t } = useLocale();
  const heroTitle = t("hero.title", "Think out loud.\nLeave with clarity.").split("\n");
  const speechTitle = t("landing.speech", "From speech\nto structure").split("\n");
  return <main className="landing-root">
    <LandingMotion />
    <header className="landing-nav">
      <Link className="landing-brand" href="/" aria-label="WIMAX home"><Sprout /> WIMAX</Link>
      <nav aria-label="Landing navigation"><a href="#product">{t("nav.how", "How it works")}</a><a href="#meetings">{t("nav.meetings", "Meetings")}</a><a href="#privacy">{t("nav.privacy", "Privacy")}</a><a href="#apps">{t("nav.apps", "Apps")}</a></nav>
      <LanguageMenu compact />
      <Link className="landing-signin" href="/login?next=%2Fdesk">{t("auth.signin", "Sign in")}</Link>
      <Link className="landing-nav-cta" href="/register?next=%2Fdesk">{t("auth.create", "Create account")} <ArrowRight /></Link>
    </header>

    <section className="landing-hero">
      <div className="landing-hero-copy">
        <h1>{heroTitle[0]}<br />{heroTitle[1]}</h1>
        <p>{t("hero.copy", "WIMAX turns voice notes, meetings and reflections into tasks, habits and connected knowledge — instantly.")}</p>
        <div className="landing-actions"><Link className="landing-primary" href="/register?next=%2Fdesk">{t("auth.workspace", "Create your workspace")} <ArrowRight /></Link><Link className="landing-secondary" href="/login?next=%2Fdesk">{t("auth.signin", "Sign in")}</Link><a className="landing-text-link" href="/downloads/cognitive-mirror-android.apk" download><Download /> Android APK</a></div>
        <small>{t("hero.private", "Private by default. Your raw thoughts stay yours.")}</small>
      </div>
      <div className="landing-hero-media">
        <Image src="/media/cognitive-mirror-voice-hero.png" alt="A person capturing a thought by voice while walking" fill priority sizes="(max-width: 900px) 100vw, 56vw" />
        <div className="voice-capture-card"><span><AudioLines /></span><div><small>LISTENING</small><strong>00:18</strong><i><b /><b /><b /><b /><b /><b /><b /><b /></i></div><span className="voice-stop" aria-hidden="true"><i /></span></div>
        <div className="hero-entities" aria-label="Example structured results">
          <div><ListChecks /><span><small>Add to Inbox</small><strong>Research ergonomic keyboard</strong></span><Check /></div>
          <div><CheckCircle2 /><span><small>Log habit</small><strong>Walk · 30 minutes</strong></span><Check /></div>
          <div><Lightbulb /><span><small>New idea</small><strong>Content system approach</strong></span><Check /></div>
          <div><WalletCards /><span><small>Record expense</small><strong>Client lunch · $48</strong></span><Check /></div>
        </div>
      </div>
    </section>

    <section className="scroll-invitation" aria-label="Scroll to discover"><span>{t("landing.scroll", "SCROLL TO FOLLOW THE THOUGHT")}</span><ArrowDown /></section>

    <section className="landing-flow" id="product">
      <h2>{speechTitle[0]}<br />{speechTitle[1]}</h2>
      <div className="flow-steps">{flow.map(({ icon: Icon, title, copy }, index) => <article key={title}><span><Icon /></span><div><strong>{index + 1}. {t(`flow.${index}.title`, title)}</strong><p>{t(`flow.${index}.copy`, copy)}</p></div>{index < flow.length - 1 ? <ArrowRight className="flow-arrow" /> : null}</article>)}</div>
    </section>

    <section className="landing-manifesto">
      <p className="manifesto-label">{t("landing.why", "WHY WIMAX")}</p>
      <h2>{t("landing.mind", "Your mind moves faster than your productivity system.")}</h2>
      <p>{t("landing.mindCopy", "Most tools ask you to stop, sort and format. WIMAX begins earlier — at the moment a thought is still unstructured.")}</p>
      <div className="manifesto-orbit"><Mic /><span>one voice</span><ArrowRight /><span>one connected system</span></div>
    </section>

    <section className="before-after">
      <div className="before-after-heading"><span>BEFORE / AFTER</span><h2>{t("before.title", "One voice note instead of ten open tabs.")}</h2></div>
      <article className="before-card"><span>{t("before.label", "BEFORE")}</span><p>Voice memo 08:42</p><p>Calendar reminder</p><p>Message to myself</p><p>Habit app checkbox</p><p>Meeting transcript</p><p>Unsorted idea in Notes</p></article>
      <article className="after-card"><span>{t("after.label", "AFTER")}</span><strong>WIMAX</strong><div><ListChecks /> 3 tasks</div><div><CheckCircle2 /> 2 habits</div><div><Lightbulb /> 1 connected idea</div><div><CalendarDays /> meeting actions</div></article>
    </section>

    <section className="journey-story" aria-label="How WIMAX works">
      <aside className="journey-intro"><span>{t("journey.label", "THE MIRROR JOURNEY")}</span><h2>{t("journey.title", "Speak once.\nKeep the meaning.").split("\n").map((line) => <span key={line}>{line}<br /></span>)}</h2><p>{t("journey.copy", "Five stages turn raw voice into a system that gets more useful over time.")}</p><nav>{journey.map((item, index) => <a href={`#journey-${item.number}`} key={item.number}>{item.number}<span>{t(`journey.${index}.title`, item.title)}</span></a>)}</nav></aside>
      <div className="journey-steps">{journey.map(({ number, icon: Icon, title, lead, copy, meta }, index) => <article id={`journey-${number}`} key={number}><div className="journey-number">{number} / 05</div><span className="journey-icon"><Icon /></span><h3>{t(`journey.${index}.title`, title)}</h3><strong>{t(`journey.${index}.lead`, lead)}</strong><p>{t(`journey.${index}.copy`, copy)}</p><div>{meta.map((item) => <span key={item}><Check /> {item}</span>)}</div></article>)}</div>
    </section>

    <section className="product-story">
      <div className="story-copy"><h2>{t("landing.command", "Your command center.")}</h2><p>{t("landing.commandCopy", "Everything you say becomes organized, searchable and ready when you are.")}</p><Link href="/login?next=%2Fdesk">{t("landing.open", "Open web app")} <ArrowRight /></Link></div>
      <DashboardPreview />
      <div className="meeting-story"><h2>{t("meeting.clean", "Meetings, captured cleanly.")}</h2><p>{t("meeting.cleanCopy", "Record long conversations and get timestamps, chapters and action items without losing the flow.")}</p><MeetingPreview /></div>
    </section>

    <section className="meeting-immersive" id="meetings">
      <div className="meeting-immersive-copy"><span>MEETING MODE</span><h2>{t("meeting.title", "Stay in the room.\nWIMAX keeps the thread.").split("\n").map((line) => <span key={line}>{line}<br /></span>)}</h2><p>{t("meeting.copy", "Long recordings are protected locally, uploaded in resumable chunks and transformed into speakers, chapters, decisions and action items.")}</p><div><span><strong>60+</strong> minutes</span><span><strong>Auto</strong> recovery</span><span><strong>Source</strong> preserved</span></div></div>
      <div className="meeting-stage"><MeetingPreview /></div>
    </section>

    <section className="use-cases"><div className="use-cases-heading"><span>{t("use.label", "ONE SYSTEM, MANY MOMENTS")}</span><h2>{t("use.title", "A place for thoughts that normally fall between tools.")}</h2></div>{useCases.map(({ icon: Icon, title, copy }, index) => <article key={title}><span>0{index + 1}</span><Icon /><h3>{t(`use.${index}.title`, title)}</h3><p>{t(`use.${index}.copy`, copy)}</p></article>)}</section>

    <section className="knowledge-story"><div><span>{t("knowledge.label", "CONNECTED MEMORY")}</span><h2>{t("knowledge.title", "Ask your past self a real question.")}</h2><p>{t("knowledge.question", "“What did I say about the rebrand two months ago, and which tasks are still open?”")}</p><Link href="/register?next=%2Fdesk">{t("knowledge.cta", "Build your knowledge graph")} <ArrowRight /></Link></div><div className="knowledge-result"><header><Search /><span>Search WIMAX</span></header><p>Rebrand discussion · 14 June</p><strong>Position the product around calm capture, not another productivity dashboard.</strong><div><span>3 source notes</span><span>2 open tasks</span><span>18:42 audio</span></div></div></section>

    <section className="privacy-story" id="privacy">
      <div className="privacy-lead"><h2>{t("landing.privacyTitle", "Privacy by design.")}</h2><p>{t("landing.privacyCopy", "Your voice is personal. We keep it that way.")}</p></div>
      {privacy.map(({ icon: Icon, title, copy }, index) => <article key={title}><Icon /><div><strong>{t(`privacy.${index}.title`, title)}</strong><p>{t(`privacy.${index}.copy`, copy)}</p></div></article>)}
    </section>

    <section className="apps-story" id="apps">
      <div className="apps-copy"><h2>{t("landing.appsTitle", "Take WIMAX with you.")}</h2><p>{t("landing.appsCopy", "Capture on the go. Your voice, your system, seamlessly across devices.")}</p></div>
      <article className="download-option"><Smartphone /><div><strong>Android</strong><span>Direct APK available</span></div><a href="/downloads/cognitive-mirror-android.apk" download>Download APK <Download /></a></article>
      <article className="download-option download-option--muted"><Smartphone /><div><strong>iOS · TestFlight</strong><span>Preparing for beta</span></div><Link href="/download/ios">View iOS status <ArrowRight /></Link></article>
    </section>

    <section className="registration-story">
      <div className="registration-heading">
        <div><span>WEB + MOBILE</span><h2>{t("registration.title", "One account.\nA familiar device.").split("\n").map((line) => <span key={line}>{line}<br /></span>)}</h2></div>
        <p>{t("registration.copy", "Create your account on web or inside the Android/iOS app. After the first secure sign-in, a recognized device only asks for your password.")}</p>
      </div>
      <div className="registration-visual">
        <div className="registration-photo"><Image src="/media/cognitive-mirror-account-devices.png" alt="A person securely connecting WIMAX across a laptop and phone" fill sizes="(max-width: 700px) 100vw, 92vw" /></div>
        <div className="registration-steps">
          <article><strong>01</strong><h3>{t("registration.0.title", "Create account")}</h3><p>{t("registration.0.copy", "Name, email and a password of at least 10 characters.")}</p></article>
          <article><strong>02</strong><h3>{t("registration.1.title", "Connect devices")}</h3><p>{t("registration.1.copy", "Mobile tokens stay in Keychain or Android Keystore.")}</p></article>
          <article><strong>03</strong><h3>{t("registration.2.title", "Return faster")}</h3><p>{t("registration.2.copy", "Your browser remembers the device without storing your password.")}</p></article>
        </div>
      </div>
      <div className="registration-actions"><Link className="landing-primary" href="/register?next=%2Fdesk">Register on web <ArrowRight /></Link><a className="landing-secondary" href="/downloads/cognitive-mirror-android.apk" download>Get Android <Download /></a></div>
    </section>

    <section className="landing-final"><div><h2>{t("landing.final", "Think out loud. Leave with clarity.")}</h2><p>{t("landing.finalCopy", "Open WIMAX and give your mind somewhere useful to land.")}</p></div><div><Link className="landing-primary" href="/register?next=%2Fdesk">{t("auth.create", "Create account")} <ArrowRight /></Link><Link className="landing-secondary" href="/login?next=%2Fdesk">{t("auth.signin", "Sign in")}</Link></div></section>

    <footer className="landing-footer"><Link className="landing-brand" href="/"><Sprout /> WIMAX</Link><nav><a href="#product">Product</a><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms</Link><a href="#apps">{t("nav.apps", "Apps")}</a></nav><span>© {new Date().getFullYear()} wimax.ai</span></footer>
  </main>;
}

function DashboardPreview() {
  return <div className="dashboard-preview" aria-label="WIMAX dashboard preview">
    <aside><span className="preview-brand"><Sprout /></span><i className="active"><Brain /></i><i><ListChecks /></i><i><CalendarDays /></i><i><BookOpen /></i></aside>
    <div className="preview-main"><header><div><small>GOOD MORNING</small><strong>Your WIMAX workspace</strong></div><span className="preview-avatar">A</span></header><section className="preview-capture"><Mic /><div><small>VOICE CAPTURE</small><strong>What’s on your mind?</strong></div><Play /></section><div className="preview-columns"><article><small>INBOX</small><strong>3 things understood</strong><p><ListChecks /> Send launch report</p><p><CheckCircle2 /> Meditation · 12 min</p><p><Lightbulb /> New positioning idea</p></article><article><small>TODAY</small><strong>Your day plan</strong><p>10:00 · Q2 planning</p><p>13:30 · Lunch with Sam</p><p>16:00 · Design review</p></article><article><small>ENERGY</small><strong>7 / 10</strong><div className="preview-energy"><i /><i /><i /><i /><i /><i /><i /></div><p>Focused · motivated</p></article></div></div>
  </div>;
}

function MeetingPreview() {
  const [expanded, setExpanded] = useState(false);
  const chapters = ["Intro and agenda", "Q1 review and highlights", "Goals and focus areas", "Risks and dependencies", "Action items"];
  return <div className={`meeting-preview ${expanded ? "is-expanded" : ""}`}><header><div><small>Q2 PLANNING MEETING</small><strong>42:18</strong></div><button aria-pressed={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? "Hide details" : "View meeting"}</button></header><div className="meeting-wave">{Array.from({ length: 38 }, (_, index) => <i key={index} style={{ height: `${10 + ((index * 17) % 25)}px` }} />)}</div>{(expanded ? chapters : chapters.slice(0, 2)).map((chapter, index) => <div className="meeting-row" key={chapter}><time>{["00:02", "05:31", "12:08", "28:47", "36:12"][index]}</time><span>{chapter}</span><Check /></div>)}</div>;
}
