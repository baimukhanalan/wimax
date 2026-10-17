"use client";

import { ArrowRight, CalendarDays, Check, Command, Database, Grid2X2, LockKeyhole, Mic, Settings2, Square, Undo2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale } from "./locale";
import { Waveform } from "./waveform";

export type VoiceReceipt = {
  id: number;
  feedback: string;
  intents: string[];
  transcript?: string;
};

export type VoiceCaptureController = {
  state: "idle" | "recording" | "processing" | "review";
  draft: string;
  setDraft: (value: string) => void;
  error: string | null;
  notice: string | null;
  pendingMeetings: number;
  level: number;
  recordingStartedAt: number | null;
  activeMode: "command" | "meeting";
  toggleRecording: (mode?: "command" | "meeting") => Promise<void>;
  submitText: () => void;
  importAudio: (file: File) => void;
};

export function VoiceCommandCenter({ capture, receipt, context, onClose, onUndo }: { capture: VoiceCaptureController; receipt: VoiceReceipt | null; context: string; onClose: () => void; onUndo: () => void }) {
  const { t } = useLocale();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!capture.recordingStartedAt) return;
    const update = () => setElapsed(Math.floor((Date.now() - capture.recordingStartedAt!) / 1000));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [capture.recordingStartedAt]);

  const recording = capture.state === "recording";
  const processing = capture.state === "processing";
  const statusTitle = recording
    ? capture.activeMode === "meeting" ? t("voice.meeting", "Recording meeting…") : t("voice.listening", "Listening…")
    : processing ? t("voice.processing", "Turning speech into action…")
      : receipt ? receipt.feedback : t("voice.title", "Tell WIMAX what to do");
  const statusCopy = recording
    ? t("voice.recordingCopy", "Speak naturally. WIMAX keeps the source audio and structures it when you stop.")
    : processing ? t("voice.processingCopy", "Transcribing, detecting intent and connecting the result to your workspace.")
      : t("voice.copy", "Create, update, search or record a meeting — without leaving this page.");

  const suggestions = [
    { icon: Database, text: "Create database from my notes", meta: "Database", shortcut: "↵" },
    { icon: Grid2X2, text: "Add properties Status Owner Due", meta: "Schema", shortcut: "⌘2" },
    { icon: CalendarDays, text: "Switch to Calendar view", meta: "View", shortcut: "⌘3" },
    { icon: Settings2, text: "Open Settings and change language", meta: "Settings", shortcut: "⌘4" },
  ];
  return <div className="voice-command-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !recording) onClose(); }}><section className={`voice-command-center voice-command-center--${capture.state}`} role="dialog" aria-modal="true" aria-label="WIMAX command palette" aria-live="polite">
    <header className="voice-palette-header"><button className="voice-palette-mic" onClick={() => void capture.toggleRecording()} disabled={processing} aria-label={recording ? "Stop recording" : "Start voice command"} style={{ "--voice-level": capture.level } as React.CSSProperties}>{recording ? <Square /> : processing ? <span className="voice-spinner" /> : <Mic />}</button><div><span>{context}</span><h1>{recording || processing ? statusTitle : receipt?.transcript || "What would you like WIMAX to do?"}</h1></div>{recording ? <time><span />{formatElapsed(elapsed)}</time> : <kbd>Esc</kbd>}<button className="voice-palette-close" onClick={onClose} aria-label="Close command palette"><X /></button></header>
    <div className="voice-live-row"><Waveform active={recording || processing} />{recording ? <button className="voice-command-stop" onClick={() => void capture.toggleRecording()}><Square />{t("voice.stop", "Stop & process")}</button> : null}</div>
    {!recording && !processing ? <><div className="voice-command-input"><Command /><input autoFocus value={capture.draft} onChange={(event) => capture.setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && capture.submitText()} placeholder="Type or say a command…" /><button onClick={capture.submitText} disabled={capture.draft.trim().length < 2}><ArrowRight /></button><label title="Import audio"><Upload /><input type="file" accept="audio/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) capture.importAudio(file); event.currentTarget.value = ""; }} /></label></div><div className="voice-palette-suggestions"><small>Suggestions</small>{suggestions.map(({ icon: Icon, text, meta, shortcut }) => <button key={text} onClick={() => capture.setDraft(text)}><Icon /><span>{text}</span><em>{meta}</em><kbd>{shortcut}</kbd></button>)}</div></> : <p className="voice-processing-copy">{statusCopy}</p>}
    <div className="voice-command-preview"><small>Preview</small><div><span><Check /></span><p>{receipt?.feedback || "WIMAX will understand the context, show the plan, then execute the command."}</p></div><footer><button className="voice-run" onClick={capture.submitText} disabled={capture.draft.trim().length < 2 || processing}>{processing ? "Working…" : "Run command"}<ArrowRight /></button><button onClick={onUndo} disabled={!receipt}><Undo2 />Undo</button></footer></div>
    {recording ? <small className="voice-private"><LockKeyhole />{capture.activeMode === "meeting" ? t("voice.meetingSafe", "Saved locally in 30-second parts · upload resumes automatically") : t("voice.private", "Audio is encrypted when secure storage is enabled")}</small> : null}
    {!recording && capture.pendingMeetings ? <p className="voice-recovery"><LockKeyhole />{capture.pendingMeetings} {t("voice.pendingMeeting", "saved meeting awaiting upload recovery")}</p> : null}
    {!recording && capture.notice ? <p className="voice-notice" role="status"><Check />{capture.notice}</p> : null}
    {capture.error ? <p className="voice-error" role="alert">{capture.error}</p> : null}
  </section></div>;
}

export function FloatingVoiceButton({ capture, onOpen }: { capture: VoiceCaptureController; onOpen: () => void }) {
  const recording = capture.state === "recording";
  return <button className={`floating-voice ${recording ? "is-recording" : ""}`} onClick={recording ? () => void capture.toggleRecording() : onOpen} disabled={capture.state === "processing"} aria-label={recording ? "Stop recording" : "Open voice command"} style={{ "--voice-level": capture.level } as React.CSSProperties}>
    {recording ? <Square /> : <Mic />}
  </button>;
}

function formatElapsed(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
