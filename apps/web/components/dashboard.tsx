"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Briefing, CaptureResponse, DashboardResponse, IntegrationStatus, SearchResponse } from "@cognitive-mirror/contracts";
import {
  ArrowRight, AudioLines, BookOpen, Brain, CalendarDays, Check,
  CheckCircle2, ChevronDown, ChevronRight, Circle, Columns3, Copy, FileText, Gauge,
  Database, Download, Globe2, History, Home, Languages, LayoutList, Lightbulb, ListChecks, LoaderCircle, Mic,
  MoreHorizontal, PanelLeftClose, PanelLeftOpen, Play, Plus, Search, Settings2,
  ShieldCheck, SlidersHorizontal, Sparkles, Sprout, Square, Star, Table2, Trash2, Upload, X,
} from "lucide-react";
import { Waveform } from "./waveform";
import { supportedLocales, useLocale } from "./locale";
import { WorkspaceDatabaseStudio, type DatabaseVoiceCommand } from "./workspace-database";
import { FloatingVoiceButton, VoiceCommandCenter, type VoiceReceipt } from "./voice-command-center";
import {
  createLocalMeeting, finishLocalMeeting, flushMeetingQueue, listLocalMeetings,
  recoverInterruptedMeetings, saveLocalMeetingChunk, WEB_MEETING_CHUNK_SECONDS,
} from "@/lib/meeting-queue";
import { useWorkspaceModel, type BlockType, type WorkspacePageRecord } from "@/lib/workspace-model";
import { WorkspacePageEditor } from "./workspace-page-editor";

type CaptureState = "idle" | "recording" | "processing" | "review";
type Variant = "desk" | "journal";
type WorkspacePage = "home" | "voice" | "today" | "tasks" | "databases" | "memories" | "patterns" | "meetings" | "settings" | "launch" | "journal-page";

const emptyData: DashboardResponse = {
  captures: [], tasks: [], habits: [], knowledge: [], financial_transactions: [], energy: [],
  stats: { open_tasks: 0, completed_habits: 0, knowledge_notes: 0, current_streak: 0 },
  persisted: false,
};

export function Dashboard({ variant = "desk" }: { variant?: Variant }) {
  const [data, setData] = useState<DashboardResponse>(emptyData);
  const [loadingData, setLoadingData] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const loadData = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (!response.ok) throw new Error("Dashboard unavailable");
      setData(await response.json());
    } catch {
      // Keep the last usable workspace snapshot while the device is offline.
    } finally {
      setLoadingData(false);
    }
  }, []);
  const capture = useCapture(loadData);

  useEffect(() => {
    let active = true;
    void fetch("/api/dashboard", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<DashboardResponse> : Promise.reject(new Error("Dashboard unavailable")))
      .then((payload) => { if (active) setData(payload); })
      .catch(() => undefined)
      .finally(() => { if (active) setLoadingData(false); });
    return () => { active = false; };
  }, []);

  return (
    <main className={`mirror-root mirror-root--${variant}`}>
      {variant === "desk"
        ? <Desk data={data} loading={loadingData} capture={capture} onSearch={openSearch} onRefresh={loadData} />
        : <Journal data={data} loading={loadingData} capture={capture} onSearch={openSearch} />}
      {capture.state === "review" && capture.result
        ? <ReviewPanel result={capture.result} onClose={capture.closeReview} />
        : null}
      {searchOpen ? <SearchDrawer onClose={() => setSearchOpen(false)} /> : null}
      {capture.meetingConsentOpen ? <MeetingConsentDialog onCancel={capture.cancelMeetingConsent} onConfirm={capture.confirmMeetingConsent} /> : null}
    </main>
  );
}

function Desk({ data, loading, capture, onSearch, onRefresh }: {
  data: DashboardResponse;
  loading: boolean;
  capture: ReturnType<typeof useCapture>;
  onSearch: () => void;
  onRefresh: () => Promise<void>;
}) {
  const { t, locale, setLocale } = useLocale();
  const [page, setPage] = useState<WorkspacePage>("databases");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [voiceReceipt, setVoiceReceipt] = useState<VoiceReceipt | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [databaseVoiceCommand, setDatabaseVoiceCommand] = useState<DatabaseVoiceCommand | null>(null);
  const workspaceModel = useWorkspaceModel();
  const { workspaces, pages, pagesByWorkspace, createWorkspace: createWorkspaceRecord, updateWorkspace, createPage: createPageRecord, updatePage, duplicatePage, archivePage } = workspaceModel;
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("alan");
  const [selectedPageId, setSelectedPageId] = useState("projects");
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const lastCommandState = useRef<{ page: WorkspacePage; workspaceId: string; selectedPageId: string; locale: typeof locale } | null>(null);
  const { registerCommandHandler, startRecording, toggleRecording } = capture;
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) || workspaces[0];
  const workspacePages = pagesByWorkspace(activeWorkspaceId);
  const selectedPage = pages.find((item) => item.id === selectedPageId && !item.archived) || workspacePages[0];
  const labels: Record<WorkspacePage, string> = { home: t("workspace.home", "Home"), voice: t("workspace.voice", "Voice inbox"), today: t("workspace.today", "Today"), tasks: t("workspace.tasks", "Tasks"), databases: selectedPage?.kind === "database" ? selectedPage.title : "Projects", memories: t("workspace.knowledge", "Knowledge"), patterns: t("workspace.patterns", "Patterns"), meetings: t("workspace.meetings", "Meetings"), settings: t("workspace.settings", "Settings"), launch: selectedPage?.title || "Untitled", "journal-page": selectedPage?.title || "Untitled" };
  const primary = [["home", t("workspace.home", "Home"), Home], ["voice", t("workspace.voice", "Voice inbox"), Mic], ["today", t("workspace.today", "Today"), CalendarDays], ["meetings", t("workspace.meetings", "Meetings"), AudioLines]] as const;
  const createWorkspace = useCallback((name: string) => {
    const workspace = createWorkspaceRecord(name);
    if (!workspace) return;
    setActiveWorkspaceId(workspace.id);
    setNewWorkspaceName("");
    setWorkspaceMenuOpen(false);
    setPage("home");
  }, [createWorkspaceRecord]);
  const createPage = useCallback((title = "Untitled", parentId: string | null = null, kind: "page" | "database" = "page") => {
    const created = createPageRecord(activeWorkspaceId, title, parentId, kind);
    setSelectedPageId(created.id);
    setPage(kind === "database" ? "databases" : "launch");
    return created;
  }, [activeWorkspaceId, createPageRecord]);
  const openWorkspacePage = useCallback((item: WorkspacePageRecord) => {
    setSelectedPageId(item.id);
    setPage(item.kind === "database" ? "databases" : "launch");
  }, []);
  useEffect(() => registerCommandHandler((result, source) => {
    lastCommandState.current = { page, workspaceId: activeWorkspaceId, selectedPageId, locale };
    const command = interpretWorkspaceCommand(result.transcript || result.parsed.raw_text_cleaned);
    setVoiceReceipt({ id: Date.now(), feedback: command.feedback || captureSummary(result), intents: command.intents, transcript: result.transcript || result.parsed.raw_text_cleaned });
    setVoiceOpen(true);
    if (command.page) setPage(command.page);
    if (command.database) {
      if (command.database.action === "create-table") createPage(command.database.name || "Untitled database", null, "database");
      setDatabaseVoiceCommand({ ...command.database, id: Date.now() });
    }
    if (command.createWorkspace) createWorkspace(command.createWorkspace);
    if (command.createPage) createPage(command.createPage);
    if (command.createSubPage) createPage(command.createSubPage, selectedPage?.id || null);
    if (command.locale) setLocale(command.locale);
    if (command.openSearch) onSearch();
    if (command.startMeeting && source !== "WEB_MEETING") {
      setPage("meetings");
      window.setTimeout(() => void startRecording("meeting"), 180);
    }
    if (command.editor && selectedPage) {
      if (command.editor.action === "rename") updatePage(selectedPage.id, { title: command.editor.value || "Untitled" });
      if (command.editor.action === "add-block") updatePage(selectedPage.id, { blocks: [...selectedPage.blocks, { id: `block-${crypto.randomUUID()}`, type: command.editor.blockType || "text", content: command.editor.value || "" }] });
      if (command.editor.action === "duplicate") {
        const duplicateId = duplicatePage(selectedPage.id);
        if (duplicateId) setSelectedPageId(duplicateId);
      }
    }
  }), [registerCommandHandler, startRecording, onSearch, createWorkspace, createPage, setLocale, page, activeWorkspaceId, selectedPageId, selectedPage, locale, updatePage, duplicatePage]);
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "v") {
        event.preventDefault();
        setVoiceOpen(true);
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [toggleRecording]);
  return <div className={`workspace-shell ${sidebarOpen ? "" : "workspace-shell--collapsed"}`}>
    <aside className="workspace-sidebar">
      <button className="workspace-switcher" onClick={() => setWorkspaceMenuOpen((value) => !value)} aria-expanded={workspaceMenuOpen}><span className="workspace-logo"><Sprout /></span><div><strong>WIMAX</strong><small>{activeWorkspace.name}</small></div><ChevronDown /></button>
      {workspaceMenuOpen ? <div className="workspace-menu"><header><strong>Workspaces</strong><button onClick={() => setWorkspaceMenuOpen(false)} aria-label="Close workspaces"><X /></button></header>{workspaces.map((workspace) => <button key={workspace.id} className={workspace.id === activeWorkspaceId ? "is-active" : ""} onClick={() => { setActiveWorkspaceId(workspace.id); setWorkspaceMenuOpen(false); setPage("home"); }}><span className="workspace-menu-icon">W</span><span><strong>{workspace.name}</strong><small>{workspace.members} member{workspace.members === 1 ? "" : "s"}</small></span>{workspace.id === activeWorkspaceId ? <Check /> : null}</button>)}<label className="workspace-rename"><span>Workspace name</span><input aria-label="Active workspace name" value={activeWorkspace.name} onChange={(event) => updateWorkspace(activeWorkspace.id, { name: event.target.value })} /></label><form onSubmit={(event) => { event.preventDefault(); createWorkspace(newWorkspaceName); }}><input aria-label="New workspace name" value={newWorkspaceName} onChange={(event) => setNewWorkspaceName(event.target.value)} placeholder="New workspace" /><button type="submit" disabled={!newWorkspaceName.trim()}><Plus /></button></form></div> : null}
      <button className="sidebar-search" onClick={onSearch}><Search /><span>{t("workspace.search", "Search")}</span><kbd>⌘ K</kbd></button>
      <nav className="workspace-nav" aria-label="Workspace navigation">
        {primary.map(([value, label, Icon]) => <button key={value} className={page === value ? "is-active" : ""} onClick={() => setPage(value)}><Icon /><span>{label}</span>{value === "voice" && data.captures.length ? <em>{data.captures.length}</em> : null}</button>)}
      </nav>
      <div className="sidebar-group sidebar-teamspace"><header><span>Teamspaces</span><button aria-label="Create teamspace page" onClick={() => createPage("Untitled team page", workspacePages.find((item) => item.id === "product")?.id || null)}><Plus /></button></header><SidebarPageTree pages={workspacePages} parentId={null} selectedId={selectedPageId} teamspaceOnly onOpen={openWorkspacePage} onToggle={(id, expanded) => updatePage(id, { expanded })} onCreateChild={(id) => createPage("Untitled", id)} onDuplicate={(id) => { const duplicateId = duplicatePage(id); if (duplicateId) setSelectedPageId(duplicateId); }} onArchive={archivePage} /></div>
      <div className="sidebar-group"><header><span>{t("workspace.favorites", "Favorites")}</span><Plus /></header>{workspacePages.filter((item) => item.favorite).map((item) => <button key={item.id} className={selectedPageId === item.id ? "is-active" : ""} onClick={() => openWorkspacePage(item)}><Star /><span>{item.title}</span></button>)}</div>
      <div className="sidebar-group"><header><span>{t("workspace.private", "Private")}</span><button aria-label="Create private page" onClick={() => createPage()}><Plus /></button></header><SidebarPageTree pages={workspacePages} parentId={null} selectedId={selectedPageId} privateOnly onOpen={openWorkspacePage} onToggle={(id, expanded) => updatePage(id, { expanded })} onCreateChild={(id) => createPage("Untitled", id)} onDuplicate={(id) => { const duplicateId = duplicatePage(id); if (duplicateId) setSelectedPageId(duplicateId); }} onArchive={archivePage} /></div>
      <button className="sidebar-new-page" onClick={() => createPage()}><Plus /> {t("workspace.newPage", "New page")}</button>
      <div className="sidebar-footer"><button onClick={() => setPage("settings")}><Settings2 /><span>{t("workspace.settings", "Settings")}</span></button><span className="avatar">A</span></div>
    </aside>
    <section className="workspace-main">
      <header className="workspace-topbar"><button className="sidebar-toggle" onClick={() => setSidebarOpen((value) => !value)} aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}>{sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}</button><div className="workspace-crumb"><span>WIMAX</span><ChevronRight /><strong>{labels[page]}</strong></div><div className="workspace-top-actions"><span>{t("workspace.saved", "Saved")}</span>{selectedPage && (page === "launch" || page === "databases") ? <button onClick={() => updatePage(selectedPage.id, { favorite: !selectedPage.favorite })} aria-label={selectedPage.favorite ? "Remove from favorites" : "Add to favorites"}><Star className={selectedPage.favorite ? "is-filled" : ""} /></button> : null}</div></header>
      <div className="workspace-canvas">
        {page === "home" ? <WorkspaceHome data={data} loading={loading} onSearch={onSearch} onOpen={(next) => setPage(next)} /> : null}
        {page === "databases" ? <WorkspaceDatabaseStudio key={selectedPage?.id || "projects"} data={data} voiceCommand={databaseVoiceCommand} databaseId={selectedPage?.id || "projects"} initialName={selectedPage?.title || "Projects"} onRename={(title) => selectedPage && updatePage(selectedPage.id, { title })} /> : null}
        {page === "voice" ? <VoiceInbox data={data} loading={loading} /> : null}
        {(page === "launch" || page === "journal-page") && selectedPage ? <WorkspacePageEditor page={selectedPage} capture={capture} onChange={(patch) => updatePage(selectedPage.id, patch)} onDuplicate={() => { const duplicateId = duplicatePage(selectedPage.id); if (duplicateId) setSelectedPageId(duplicateId); }} onArchive={() => { archivePage(selectedPage.id); setPage("home"); }} onCreateChild={() => createPage("Untitled", selectedPage.id)} /> : null}
        {page === "today" || page === "tasks" || page === "memories" || page === "patterns" || page === "settings" ? <DeskCollection section={page} data={data} loading={loading} onSearch={onSearch} onRefresh={onRefresh} /> : null}
        {page === "meetings" ? <WorkspaceMeetings data={data} /> : null}
      </div>
    </section>
    {voiceOpen ? <VoiceCommandCenter capture={capture} receipt={voiceReceipt} context={`${activeWorkspace.name} / ${labels[page]}`} onClose={() => setVoiceOpen(false)} onUndo={() => { const previous = lastCommandState.current; if (!previous) return; setPage(previous.page); setActiveWorkspaceId(previous.workspaceId); setSelectedPageId(previous.selectedPageId); setLocale(previous.locale); setVoiceReceipt(null); }} /> : null}
    <FloatingVoiceButton capture={capture} onOpen={() => setVoiceOpen(true)} />
  </div>;
}

function SidebarPageTree({ pages, parentId, selectedId, onOpen, onToggle, onCreateChild, onDuplicate, onArchive, depth = 0, teamspaceOnly = false, privateOnly = false }: {
  pages: WorkspacePageRecord[]; parentId: string | null; selectedId: string; depth?: number; teamspaceOnly?: boolean; privateOnly?: boolean;
  onOpen: (page: WorkspacePageRecord) => void; onToggle: (id: string, expanded: boolean) => void; onCreateChild: (id: string) => void; onDuplicate: (id: string) => void; onArchive: (id: string) => void;
}) {
  const [menuId, setMenuId] = useState<string | null>(null);
  let nodes = pages.filter((item) => item.parentId === parentId);
  if (parentId == null && teamspaceOnly) nodes = nodes.filter((item) => item.id === "product");
  if (parentId == null && privateOnly) nodes = nodes.filter((item) => item.id !== "product");
  return <div className="sidebar-page-tree">{nodes.map((item) => {
    const children = pages.filter((candidate) => candidate.parentId === item.id);
    const Icon = item.kind === "database" ? Database : FileText;
    return <div className="sidebar-page-node" key={item.id} style={{ "--tree-depth": depth } as React.CSSProperties}>
      <div className={`sidebar-page-row ${selectedId === item.id ? "is-active" : ""}`}>
        <button className="sidebar-page-toggle" aria-label={`${item.expanded ? "Collapse" : "Expand"} ${item.title}`} onClick={() => onToggle(item.id, !item.expanded)} disabled={!children.length}>{children.length ? item.expanded ? <ChevronDown /> : <ChevronRight /> : null}</button>
        <button className="sidebar-page-open" onClick={() => onOpen(item)}><Icon /><span>{item.title || "Untitled"}</span></button>
        <button className="sidebar-page-more" aria-label={`Actions for ${item.title}`} onClick={() => setMenuId((value) => value === item.id ? null : item.id)}><MoreHorizontal /></button>
        {menuId === item.id ? <div className="sidebar-page-menu"><button onClick={() => { onCreateChild(item.id); setMenuId(null); }}><Plus />Add sub-page</button><button onClick={() => { onDuplicate(item.id); setMenuId(null); }}><Copy />Duplicate</button><button onClick={() => { onArchive(item.id); setMenuId(null); }}><Trash2 />Move to trash</button></div> : null}
      </div>
      {item.expanded && children.length ? <SidebarPageTree pages={pages} parentId={item.id} selectedId={selectedId} depth={depth + 1} onOpen={onOpen} onToggle={onToggle} onCreateChild={onCreateChild} onDuplicate={onDuplicate} onArchive={onArchive} /> : null}
    </div>;
  })}</div>;
}

function WorkspaceHome({ data, loading, onSearch, onOpen }: { data: DashboardResponse; loading: boolean; onSearch: () => void; onOpen: (page: "voice" | "tasks" | "memories" | "patterns") => void }) {
  const [view, setView] = useState<"table" | "board" | "list">("table");
  const [filter, setFilter] = useState("ALL");
  const rows = data.tasks.filter((task) => filter === "ALL" || task.status === filter).slice(0, 8);
  return <div className="workspace-home">
    <section className="home-heading"><div className="page-icon"><Sprout /></div><p>Monday, 24 August</p><h1>Good morning, Alan</h1><span>Your workspace is already organised from what you said.</span></section>
    <section className="mirror-home-grid"><article className="home-panel home-panel--wide"><header><div><small>MY WORK</small><h2>Continue where you left off</h2></div><button onClick={onSearch}><Search /> Ask WIMAX</button></header><div className="continue-grid"><button onClick={() => onOpen("tasks")}><ListChecks /><span><strong>Launch tasks</strong><small>{data.stats.open_tasks} open items</small></span><ChevronRight /></button><button onClick={() => onOpen("memories")}><BookOpen /><span><strong>Knowledge graph</strong><small>{data.stats.knowledge_notes} connected notes</small></span><ChevronRight /></button><button onClick={() => onOpen("patterns")}><Gauge /><span><strong>Patterns</strong><small>{data.stats.current_streak} day rhythm</small></span><ChevronRight /></button></div></article><article className="home-panel home-coach"><small>WIMAX NOTICED</small><Brain /><p>{coachObservation(data)}</p><button onClick={() => onOpen("voice")}>Talk it through <ArrowRight /></button></article></section>
    <section className="workspace-database"><header><div><div className="database-icon"><ListChecks /></div><div><small>DATABASE</small><h2>Projects & tasks</h2></div></div></header><div className="database-toolbar"><div className="database-views"><button className={view === "table" ? "is-active" : ""} onClick={() => setView("table")}><Table2 /> Table</button><button className={view === "board" ? "is-active" : ""} onClick={() => setView("board")}><Columns3 /> Board</button><button className={view === "list" ? "is-active" : ""} onClick={() => setView("list")}><LayoutList /> List</button></div><div className="database-tools"><label><SlidersHorizontal /> Filter<select aria-label="Filter tasks" value={filter} onChange={(event) => setFilter(event.target.value)}><option>ALL</option><option>OPEN</option><option>COMPLETED</option></select></label><button onClick={() => onOpen("tasks")}><Plus /> New</button></div></div>{loading ? <LoadingRows /> : <WorkspaceDatabaseView view={view} tasks={rows} />}</section>
  </div>;
}

function WorkspaceDatabaseView({ view, tasks }: { view: "table" | "board" | "list"; tasks: DashboardResponse["tasks"] }) {
  if (view === "board") return <div className="database-board">{["OPEN", "IN PROGRESS", "COMPLETED"].map((status) => <section key={status}><header><span />{status}<em>{tasks.filter((task) => status === "IN PROGRESS" ? task.priority === "HIGH" : task.status === status).length}</em></header>{tasks.filter((task) => status === "IN PROGRESS" ? task.priority === "HIGH" : task.status === status).map((task) => <article key={task.id}><strong>{task.title}</strong><small>{task.project}</small><span>{task.due_date ? formatDue(task.due_date) : "No deadline"}</span></article>)}</section>)}</div>;
  if (view === "list") return <div className="database-list">{tasks.map((task) => <article key={task.id}><Circle /><div><strong>{task.title}</strong><small>{task.project} · {task.priority}</small></div><span>{task.due_date ? formatDue(task.due_date) : "Anytime"}</span></article>)}</div>;
  return <div className="database-table"><div className="database-tr database-th"><span>Name</span><span>Status</span><span>Project</span><span>Due</span><span>Priority</span></div>{tasks.map((task) => <div className="database-tr" key={task.id}><strong><FileText />{task.title}</strong><span><i className={`status-dot status-dot--${task.status.toLowerCase()}`} />{task.status.toLowerCase()}</span><span>{task.project}</span><span>{task.due_date ? formatDue(task.due_date) : "—"}</span><span>{task.priority}</span></div>)}</div>;
}

function VoiceInbox({ data, loading }: { data: DashboardResponse; loading: boolean }) {
  return <div className="workspace-page"><div className="document-icon document-icon--voice"><Mic /></div><h1>Voice inbox</h1><p className="workspace-page-intro">Every raw thought becomes a page, task, habit or connected insight. Capture first; organise automatically.</p><section className="workspace-database workspace-database--page"><header><div><div className="database-icon"><AudioLines /></div><div><small>RECENT CAPTURES</small><h2>Processed by WIMAX</h2></div></div><span>{data.captures.length} captures</span></header>{loading ? <LoadingRows /> : data.captures.map((item) => <article className="capture-page-row" key={item.id}><span className="capture-source"><Mic /></span><div><strong>{item.summary}</strong><p>{item.raw_text_cleaned}</p></div><span>{item.energy_score}/10 energy</span><small>{new Date(item.created_at).toLocaleDateString()}</small><ChevronRight /></article>)}</section></div>;
}

function WorkspaceMeetings({ data }: { data: DashboardResponse }) {
  return <div className="workspace-page"><div className="document-icon"><AudioLines /></div><h1>Meetings</h1><p className="workspace-page-intro">Long recordings, speaker-separated transcripts and decisions in one connected archive.</p><section className="meeting-database"><header><span>Meeting</span><span>Source</span><span>Related project</span><span>Last edited</span></header>{data.captures.slice(0, 5).map((capture, index) => <article key={capture.id}><strong><AudioLines />{capture.summary}</strong><span>{capture.source}</span><span>{data.tasks[index]?.project || "Inbox"}</span><span>{new Date(capture.created_at).toLocaleDateString()}</span></article>)}</section></div>;
}

function DeskCollection({ section, data, loading, onSearch, onRefresh }: {
  section: "today" | "tasks" | "memories" | "patterns" | "settings";
  data: DashboardResponse;
  loading: boolean;
  onSearch: () => void;
  onRefresh: () => Promise<void>;
}) {
  if (section === "settings") return <SettingsPanel />;
  if (section === "patterns") return <section className="collection-panel patterns-panel"><div className="collection-heading"><div><p className="overline">LAST 28 DAYS</p><h2>Your rhythm, not a score</h2></div><strong>{data.stats.current_streak} day streak</strong></div><div className="pattern-grid">{Array.from({ length: 28 }, (_, index) => { const energy = data.energy[index]?.average || [4, 6, 5, 7][index % 4]; return <span key={index} data-level={Math.max(1, Math.min(5, Math.round(energy / 2)))} title={`Energy ${energy}/10`} />; })}</div><div className="pattern-summary"><div><strong>{latestEnergy(data)}/10</strong><span>Latest energy</span></div><div><strong>{data.stats.completed_habits}</strong><span>Habit events</span></div><div><strong>{data.captures.length}</strong><span>Voice captures</span></div></div><div className="coach-note"><Brain /><div><small>THREE-DAY SIGNAL</small><p>{coachObservation(data)}</p></div></div><BriefingPanel /></section>;

  if (section === "tasks") return <TaskCollection data={data} loading={loading} onRefresh={onRefresh} />;
  if (section === "memories") return <MemoryCollection data={data} loading={loading} onSearch={onSearch} />;

  const rows = [...data.tasks.slice(0, 5).map((task) => ({ id: task.id, icon: <ListChecks />, tone: "coral", label: "Task", title: task.title, copy: task.action_items[0] || task.project, meta: task.due_date ? formatDue(task.due_date) : task.project })), ...data.habits.slice(0, 5).map((habit) => ({ id: habit.id, icon: <Check />, tone: "sage", label: "Habit", title: habit.habit_name, copy: habit.notes, meta: habit.status }))];
  return <section className="collection-panel"><div className="collection-heading"><div><p className="overline">YOUR DAY</p><h2>Today’s commitments</h2></div><strong>{rows.length} items</strong></div>{loading ? <LoadingRows /> : rows.map((row) => <EntityRow key={row.id} icon={row.icon} tone={row.tone} label={row.label} title={row.title} copy={row.copy} meta={row.meta} />)}</section>;
}

function TaskCollection({ data, loading, onRefresh }: { data: DashboardResponse; loading: boolean; onRefresh: () => Promise<void> }) {
  const [project, setProject] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const projects = useMemo(() => ["ALL", ...Array.from(new Set(data.tasks.map((task) => task.project))).sort()], [data.tasks]);
  const tasks = data.tasks.filter((task) => (project === "ALL" || task.project === project) && (status === "ALL" || task.status === status));
  async function completeSelected() {
    if (!data.persisted || !selected.length) return;
    setSaving(true);
    try {
      await Promise.all(selected.map((id) => fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "COMPLETED" }) }).then((response) => { if (!response.ok) throw new Error("Bulk task update failed"); })));
      setSelected([]);
      await onRefresh();
    } finally { setSaving(false); }
  }
  return <section className="collection-panel"><div className="collection-heading"><div><p className="overline">ALL PROJECTS</p><h2>Tasks without the busywork</h2></div><strong>{data.tasks.filter((task) => task.status === "OPEN").length} open</strong></div><div className="collection-filters"><label>Project<select value={project} onChange={(event) => setProject(event.target.value)}>{projects.map((value) => <option key={value}>{value}</option>)}</select></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option>ALL</option><option>OPEN</option><option>COMPLETED</option><option>CANCELLED</option></select></label><button onClick={() => void completeSelected()} disabled={!selected.length || saving}>{saving ? <LoaderCircle className="spin" /> : <CheckCircle2 />} Complete selected ({selected.length})</button></div>{loading ? <LoadingRows /> : tasks.length ? tasks.map((task) => <div className="selectable-row" key={task.id}><input type="checkbox" aria-label={`Select ${task.title}`} checked={selected.includes(task.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, task.id] : current.filter((id) => id !== task.id))} /><TaskRow task={task} onRefresh={onRefresh} persisted={data.persisted} /></div>) : <p className="collection-empty">No tasks match these filters.</p>}</section>;
}

function MemoryCollection({ data, loading, onSearch }: { data: DashboardResponse; loading: boolean; onSearch: () => void }) {
  const [category, setCategory] = useState("ALL");
  const [tag, setTag] = useState("");
  const categories = useMemo(() => ["ALL", ...Array.from(new Set(data.knowledge.map((note) => note.category))).sort()], [data.knowledge]);
  const notes = data.knowledge.filter((note) => (category === "ALL" || note.category === category) && (!tag.trim() || note.tags.some((value) => value.toLowerCase().includes(tag.trim().toLowerCase()))));
  return <section className="collection-panel"><div className="collection-heading"><div><p className="overline">KNOWLEDGE GRAPH</p><h2>Connected memories</h2></div><button className="text-action text-action--inline" onClick={onSearch}>Ask WIMAX <Search /></button></div><div className="collection-filters"><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label><label>Tag<input value={tag} onChange={(event) => setTag(event.target.value)} placeholder="energy, launch…" /></label><span>{notes.length} notes</span></div>{loading ? <LoadingRows /> : notes.length ? notes.map((note) => <EntityRow key={note.id} icon={<Lightbulb />} tone="mint" label={note.category} title={note.topic} copy={note.content} meta={note.tags.slice(0, 3).join(" · ")} />) : <p className="collection-empty">No memories match these filters.</p>}</section>;
}

function TaskRow({ task, onRefresh, persisted }: { task: DashboardResponse["tasks"][number]; onRefresh: () => Promise<void>; persisted: boolean }) {
  const [saving, setSaving] = useState(false);
  async function toggle() {
    if (!persisted) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: task.status === "COMPLETED" ? "OPEN" : "COMPLETED" }) });
      if (!response.ok) throw new Error("Task update failed");
      await onRefresh();
    } finally { setSaving(false); }
  }
  return <article className={`task-row ${task.status === "COMPLETED" ? "task-row--done" : ""}`}><button onClick={() => void toggle()} disabled={saving || !persisted} aria-label={`${task.status === "COMPLETED" ? "Reopen" : "Complete"} ${task.title}`}>{saving ? <LoaderCircle className="spin" /> : task.status === "COMPLETED" ? <Check /> : <Circle />}</button><div><small>{task.project} · {task.priority}</small><strong>{task.title}</strong><p>{task.action_items.join(" · ")}</p></div><span>{task.due_date ? formatDue(task.due_date) : "No deadline"}</span></article>;
}

function SettingsPanel() {
  return <div className="settings-stack"><LanguageSettings /><IntegrationPanel /><PrivacyPanel /><LegalPanel /><DeleteAccountPanel /></div>;
}

function LanguageSettings() {
  const { locale, setLocale, t } = useLocale();
  return <section className="collection-panel language-settings"><div className="collection-heading"><div><p className="overline">{t("settings.title", "SETTINGS")}</p><h2>{t("settings.language", "Language & region")}</h2></div><Languages /></div><p>{t("settings.languageCopy", "Choose your interface language. This setting is saved on this device.")}</p><div className="settings-layout"><nav aria-label="Settings section"><span className="is-active"><Globe2 />{t("settings.language", "Language & region")}</span></nav><div className="locale-options">{supportedLocales.map((option) => <button key={option.value} className={locale === option.value ? "is-active" : ""} onClick={() => setLocale(option.value)}><span>{option.short}</span><div><strong>{option.label}{option.value === "en" ? ` (${t("settings.default", "Default")})` : ""}</strong><small>{option.value === "en" ? "August 25, 2026 · 1,234.56" : option.value === "ru" ? "25 августа 2026 г. · 1 234,56" : "2026 ж. 25 тамыз · 1 234,56"}</small></div>{locale === option.value ? <CheckCircle2 /> : <Circle />}</button>)}</div></div></section>;
}

function IntegrationPanel() {
  const [items, setItems] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void fetch("/api/integrations").then((response) => response.json()).then((payload) => setItems(payload.integrations || [])).finally(() => setLoading(false)); }, []);
  return <section className="collection-panel integrations-panel"><div className="collection-heading"><div><p className="overline">CONNECTIONS</p><h2>Bring voice in. Send structure out.</h2></div><span className="privacy-chip">Transient audio · encrypted transport</span></div>{loading ? <LoadingRows /> : items.map((item) => <article className="integration-row" key={item.provider}><span className={`integration-status integration-status--${item.status.toLowerCase()}`} /><div><strong>{item.provider.replaceAll("_", " ")}</strong><p>{item.capabilities.join(" · ")}</p></div><span>{item.status.replaceAll("_", " ")}</span><small>{item.message || "Configured and ready"}</small></article>)}</section>;
}

function PrivacyPanel() {
  const [exporting, setExporting] = useState(false);
  async function exportData() {
    setExporting(true);
    try {
      const response = await fetch("/api/privacy/export", { cache: "no-store" });
      if (!response.ok) throw new Error("Export unavailable");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `cognitive-mirror-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  }
  return <section className="collection-panel privacy-panel"><div className="collection-heading"><div><p className="overline">PRIVACY</p><h2>Your memory remains portable.</h2></div><ShieldCheck /></div><p>Raw audio is processed according to your selected mode. Structured captures can be exported at any time, and deleting a capture cascades through its transcript, tasks, habits and knowledge links.</p><button className="privacy-export" onClick={() => void exportData()} disabled={exporting}>{exporting ? <LoaderCircle className="spin" /> : <Download />} Export my WIMAX data</button></section>;
}

function LegalPanel() {
  return <section className="collection-panel legal-settings"><div className="collection-heading"><div><p className="overline">LEGAL & RECORDING</p><h2>Clear rules before the microphone turns on.</h2></div><ShieldCheck /></div><p>Meeting Mode asks for confirmation before every recording. You must notify all participants and obtain any consent or other lawful basis required where you are.</p><div className="legal-settings-links"><Link href="/privacy" target="_blank">Privacy Policy <ArrowRight /></Link><Link href="/terms" target="_blank">Terms of Service <ArrowRight /></Link><Link href="/account-deletion" target="_blank">Account deletion <ArrowRight /></Link></div><small>Draft launch documents · effective 25 August 2026 · legal review required before commercial launch.</small></section>;
}

function DeleteAccountPanel() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove() {
    if (confirmation !== "DELETE" || !password || busy) return;
    if (!window.confirm("Permanently delete this WIMAX account and all active-service data? This cannot be undone.")) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, confirmation }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error === "INVALID_PASSWORD" ? "The password is incorrect." : payload.error || "Account deletion failed.");
      router.push("/register?deleted=1");
    } catch (deletionError) { setError(deletionError instanceof Error ? deletionError.message : "Account deletion failed."); }
    finally { setBusy(false); }
  }
  return <section className="collection-panel delete-account-panel"><div className="collection-heading"><div><p className="overline">DANGER ZONE</p><h2>Delete account</h2></div><Trash2 /></div><p>This permanently removes your account and active WIMAX data. Export your workspace first if you need a copy.</p><div className="delete-account-fields"><input aria-label="Current password for account deletion" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Current password" autoComplete="current-password" /><input aria-label="Type DELETE to confirm" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Type DELETE" /></div>{error ? <small className="delete-account-error">{error}</small> : null}<button className="delete-account-button" disabled={busy || !password || confirmation !== "DELETE"} onClick={() => void remove()}>{busy ? <LoaderCircle className="spin" /> : <Trash2 />} Permanently delete account</button></section>;
}

function MeetingConsentDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  return <div className="meeting-consent-backdrop" role="presentation" onClick={onCancel}><section className="meeting-consent-dialog" role="dialog" aria-modal="true" aria-labelledby="meeting-consent-title" onClick={(event) => event.stopPropagation()}><button className="meeting-consent-close" onClick={onCancel} aria-label="Cancel meeting recording"><X /></button><span className="meeting-consent-icon"><AudioLines /></span><p className="overline">BEFORE EVERY RECORDING</p><h2 id="meeting-consent-title">Confirm participant notice and recording authority.</h2><p>WIMAX will capture audio, keep recoverable local chunks, upload them for transcription and AI processing, and create speaker labels, chapters, decisions and action items.</p><label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I confirm that every participant has been informed that WIMAX will record and process the meeting, and that I have obtained all consent or another lawful basis required by applicable law.</span></label><small>WIMAX cannot determine whether recording is lawful in your location. If you are unsure, do not record. Read the <Link href="/privacy" target="_blank">Privacy Policy</Link> and <Link href="/terms" target="_blank">Terms</Link>.</small><footer><button onClick={onCancel}>Cancel</button><button className="meeting-consent-confirm" disabled={!confirmed} onClick={onConfirm}><Mic /> Confirm & start recording</button></footer></section></div>;
}

function BriefingPanel() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void fetch("/api/briefings/weekly", { cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error("Briefing unavailable"); const payload = await response.json(); setBriefing(payload.briefing); }).catch(() => setError("Generate your first weekly briefing when you are ready.")).finally(() => setLoading(false)); }, []);
  async function generate() {
    setGenerating(true); setError(null);
    try {
      const response = await fetch("/api/briefings/weekly", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audio: true }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Briefing generation failed");
      setBriefing(payload.briefing);
    } catch (briefingError) { setError(briefingError instanceof Error ? briefingError.message : "Briefing generation failed"); }
    finally { setGenerating(false); }
  }
  return <section className="briefing-card"><div className="briefing-icon"><Play /></div><div className="briefing-copy"><small>MONDAY AUDIO BRIEFING</small>{loading ? <p>Loading your latest briefing…</p> : briefing ? <><h3>{briefing.title}</h3><p>{briefing.summary}</p><ul>{briefing.insights.map((insight) => <li key={insight}>{insight}</li>)}</ul>{briefing.audio_available ? <audio controls preload="none" src={`/api/briefings/${briefing.id}/audio`} /> : null}</> : <p>{error || "Your weekly progress, blind spots and next focus in one short episode."}</p>}</div><button onClick={() => void generate()} disabled={generating}>{generating ? <LoaderCircle className="spin" /> : <Sparkles />} {briefing ? "Regenerate" : "Create briefing"}</button></section>;
}

function Journal({ data, loading, capture, onSearch }: {
  data: DashboardResponse;
  loading: boolean;
  capture: ReturnType<typeof useCapture>;
  onSearch: () => void;
}) {
  const latest = data.captures[0];
  const note = data.knowledge[0];
  const task = data.tasks[0];
  return <div className="journal-shell">
    <header className="journal-nav">
      <Link className="journal-brand" href="/journal"><Sprout />WIMAX</Link>
      <nav><button onClick={() => scrollToId("journal-today")}>Today</button><button onClick={() => scrollToId("journal-reflection")}>Journal</button><button onClick={() => scrollToId("journal-pattern")}>Patterns</button><button onClick={() => scrollToId("journal-reflection")}>Projects</button></nav>
      <div className="variant-switch"><Link href="/desk">Desk</Link><Link className="is-active" href="/journal">Journal</Link></div>
      <button className="icon-button" onClick={onSearch} aria-label="Search"><Search /></button><span className="avatar avatar--light">A</span>
    </header>

    <section className="journal-hero" id="journal-today">
      <p className="journal-date">Monday, 24 August</p>
      <h1>Make space for what<br />your mind is carrying.</h1>
      <div className={`orbital-capture orbital-capture--${capture.state}`}>
        <Waveform active={capture.state === "recording"} />
        <button onClick={() => void capture.toggleRecording()} disabled={capture.state === "processing"} aria-label={capture.state === "recording" ? "Stop recording" : "Start recording"}>
          {capture.state === "recording" ? <Square /> : capture.state === "processing" ? <LoaderCircle className="spin" /> : <Mic />}
        </button>
      </div>
      <strong className="capture-label">{capture.state === "recording" ? "Listening… tap when you’re done" : capture.state === "processing" ? "Finding the structure" : "Begin a voice reflection"}</strong>
      <div className="journal-input"><input value={capture.draft} onChange={(event) => capture.setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && capture.submitText()} placeholder="Or write a thought here…" /><button onClick={capture.submitText} disabled={!capture.draft.trim()}>Reflect <ArrowRight /></button></div>
      <label className="journal-import"><Upload /> Import a voice note<input type="file" accept="audio/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) capture.importAudio(file); event.currentTarget.value = ""; }} /></label>
      {capture.error ? <p className="error" role="alert">{capture.error}</p> : null}
    </section>

    <section className="reflection-layout" id="journal-reflection">
      <aside className="chapter-index"><p className="overline">RECENT REFLECTION</p><strong>{latest ? durationLabel(latest.raw_text_cleaned) : "12 min"}</strong><span>3 meaningful chapters</span><div className="chapter-line"><i /><i /><i /></div>{latest?.audio_available ? <audio className="source-audio" controls preload="none" src={`/api/captures/${latest.id}/audio`} /> : <span className="chapter-source"><AudioLines /> Source transcript</span>}</aside>
      <article className="reflection-copy">
        {loading ? <LoadingRows /> : <>
          <p className="dropcap">{latest?.raw_text_cleaned || "Your thoughts will appear here as a calm, structured journal after each voice reflection."}</p>
          {task ? <aside className="margin-note margin-note--task"><ListChecks /><span>Task</span><strong>{task.title}</strong><small>{task.due_date ? formatDue(task.due_date) : task.project}</small></aside> : null}
          <h2>{note?.topic || "A pattern worth noticing"}</h2>
          <p>{note?.content || "WIMAX connects new reflections to previous ideas without asking you to maintain links manually."}</p>
          {note ? <aside className="margin-note margin-note--insight"><Sparkles /><span>Insight</span><strong>{note.tags.join(" · ")}</strong></aside> : null}
        </>}
        <div className="connected-thought" id="journal-pattern"><History /><div><small>CONNECTED THOUGHT</small><strong>{data.knowledge[1]?.topic || "Launch pressure pattern"}</strong><p>{data.knowledge[1]?.content || "A related reflection from last week."}</p></div><ChevronRight /></div>
      </article>
    </section>
  </div>;
}

function EntityRow({ icon, tone, label, title, copy, meta }: { icon: React.ReactNode; tone: string; label: string; title: string; copy: string; meta: string }) {
  return <article className="entity-row"><span className={`entity-icon entity-icon--${tone}`}>{icon}</span><div className="entity-kind"><small>{label}</small><strong>{title}</strong></div><p>{copy}</p><span className="entity-meta">{meta}</span><ChevronRight className="entity-chevron" aria-hidden="true" /></article>;
}

function LoadingRows() { return <div className="loading-rows" aria-label="Loading"><span /><span /><span /></div>; }

type ReviewCommand = { id: string; provider: string; title: string; status: string; requires_confirmation: boolean; error?: string | null };

function ReviewPanel({ result, onClose }: { result: CaptureResponse; onClose: () => void }) {
  const entities = [...result.parsed.tasks.map((item) => ({ label: "Task", value: item.title })), ...result.parsed.habits.map((item) => ({ label: "Habit", value: item.habit_name })), ...result.parsed.knowledge_base.map((item) => ({ label: "Insight", value: item.topic }))];
  const [commands, setCommands] = useState<ReviewCommand[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  useEffect(() => {
    if (!result.capture_id || !result.parsed.commands.length) return;
    const controller = new AbortController();
    void fetch(`/api/commands?capture_id=${encodeURIComponent(result.capture_id)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("Commands unavailable"); return response.json(); })
      .then((payload: { commands?: ReviewCommand[] }) => setCommands(payload.commands || []))
      .catch((commandError) => { if (commandError instanceof Error && commandError.name !== "AbortError") console.warn("voice_commands_unavailable", commandError.message); });
    return () => controller.abort();
  }, [result.capture_id, result.parsed.commands.length]);
  async function execute(id: string) {
    setRunning(id);
    try {
      const response = await fetch(`/api/commands/${encodeURIComponent(id)}/execute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmed: true }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Command failed");
      setCommands((current) => current.map((command) => command.id === id ? { ...command, status: payload.status } : command));
    } catch (commandError) {
      setCommands((current) => current.map((command) => command.id === id ? { ...command, status: "FAILED", error: commandError instanceof Error ? commandError.message : "Command failed" } : command));
    } finally { setRunning(null); }
  }
  const proposedCommands: ReviewCommand[] = commands.length ? commands : result.parsed.commands.map((command, index) => ({ id: `draft-${index}`, provider: command.provider, title: command.title, status: "DRAFT", requires_confirmation: command.requires_confirmation, error: null }));
  return <div className="review-backdrop" onClick={onClose}><section className="review-panel" onClick={(event) => event.stopPropagation()}><button className="review-close" onClick={onClose} aria-label="Close"><X /></button><div className="review-heading"><span><CheckCircle2 /></span><div><small>VOICE CAPTURE STRUCTURED</small><h2>{result.parsed.summary}</h2></div></div><p>{result.parsed.raw_text_cleaned}</p>{entities.length ? <div className="review-entities">{entities.map((entity, index) => <div key={`${entity.label}-${index}`}><span>{entity.label}</span><strong>{entity.value}</strong></div>)}</div> : null}{proposedCommands.length ? <div className="review-commands"><header><span>External actions</span><small>Confirmation is required before WIMAX changes another app.</small></header>{proposedCommands.map((command) => <article key={command.id}><div><small>{command.provider.replaceAll("_", " ")}</small><strong>{command.title}</strong>{command.error ? <em>{command.error}</em> : null}</div>{command.status === "COMPLETED" || command.status === "AWAITING_DEVICE" ? <span><Check />{command.status === "COMPLETED" ? "Done" : "Continue on device"}</span> : <button onClick={() => void execute(command.id)} disabled={running === command.id || command.id.startsWith("draft-")}>{running === command.id ? <LoaderCircle className="spin" /> : <ArrowRight />} Confirm & run</button>}</article>)}</div> : null}<footer><span>Energy {result.parsed.energy_score}/10</span><span>{result.persisted ? "Audio and structure saved to WIMAX" : "Preview mode · connect PostgreSQL to persist"}</span><button onClick={onClose}>Done</button></footer></section></div>;
}

function SearchDrawer({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  async function search() {
    if (query.trim().length < 2) return;
    setLoading(true);
    try {
      const response = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, limit: 8 }) });
      if (!response.ok) throw new Error("Search unavailable");
      setResult(await response.json());
    } finally { setLoading(false); }
  }
  return <div className="search-backdrop" onClick={onClose}><section className="search-drawer" onClick={(event) => event.stopPropagation()}><header><div><small>ASK WIMAX</small><h2>Find the thought behind the task.</h2></div><button onClick={onClose} aria-label="Close"><X /></button></header><div className="search-box"><Search /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void search()} placeholder="What did I say about the rebrand two months ago?" /><button onClick={() => void search()} disabled={loading || query.trim().length < 2}>{loading ? <LoaderCircle className="spin" /> : <ArrowRight />}</button></div>{result ? <div className="search-results"><div className="search-answer"><Sparkles /><p>{result.answer}</p></div>{result.hits.map((hit, index) => <article key={hit.id}><span>{index + 1}</span><div><small>{hit.kind} · {new Date(hit.created_at).toLocaleDateString()}</small><strong>{hit.title}</strong><p>{hit.excerpt}</p></div></article>)}</div> : <div className="search-empty"><AudioLines /><p>Ask in natural language. WIMAX searches your captures, transcripts and connected notes together.</p></div>}</section></div>;
}

function useCapture(onSaved: () => void) {
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const meetingLocalId = useRef<string | null>(null);
  const meetingChunkIndex = useRef(0);
  const meetingWriteChain = useRef<Promise<void>>(Promise.resolve());
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const recordingMode = useRef<"command" | "meeting">("command");
  const commandHandler = useRef<((result: CaptureResponse, source: string) => void) | null>(null);
  const meterFrame = useRef<number | null>(null);
  const meterValues = useRef<number[]>([]);
  const audioContext = useRef<AudioContext | null>(null);
  const [state, setState] = useState<CaptureState>("idle");
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<CaptureResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [activeMode, setActiveMode] = useState<"command" | "meeting">("command");
  const [pendingMeetings, setPendingMeetings] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [meetingConsentOpen, setMeetingConsentOpen] = useState(false);

  const refreshPendingMeetings = useCallback(async () => {
    setPendingMeetings((await listLocalMeetings()).filter((meeting) => meeting.endedAt != null).length);
  }, []);

  const submit = useCallback(async (body: FormData | Record<string, string>, source: string) => {
    setState("processing"); setError(null);
    try {
      const form = body instanceof FormData;
      const response = await fetch("/api/capture", { method: "POST", headers: form ? undefined : { "Content-Type": "application/json" }, body: form ? body : JSON.stringify(body) });
      const payload = await response.json() as CaptureResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Capture failed");
      setResult(payload); setDraft(""); setState("review"); onSaved();
      commandHandler.current?.(payload, source);
    } catch (captureError) { setError(captureError instanceof Error ? captureError.message : "Capture failed"); setState("idle"); }
  }, [onSaved]);

  const finishMetering = useCallback(() => {
    if (meterFrame.current != null) cancelAnimationFrame(meterFrame.current);
    meterFrame.current = null;
    const values = meterValues.current;
    meterValues.current = [];
    const averageDb = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const peakDb = values.length ? Math.max(...values) : null;
    const variabilityDb = values.length && averageDb != null ? Math.sqrt(values.reduce((sum, value) => sum + (value - averageDb) ** 2, 0) / values.length) : null;
    setLevel(0);
    setRecordingStartedAt(null);
    void audioContext.current?.close();
    audioContext.current = null;
    return { averageDb, peakDb, variabilityDb };
  }, []);

  const startMetering = useCallback((stream: MediaStream) => {
    const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    context.createMediaStreamSource(stream).connect(analyser);
    audioContext.current = context;
    meterValues.current = [];
    const samples = new Uint8Array(analyser.fftSize);
    let lastPaint = 0;
    const sample = (time: number) => {
      analyser.getByteTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples.length);
      const db = Math.max(-72, 20 * Math.log10(Math.max(rms, 0.00025)));
      meterValues.current.push(db);
      if (meterValues.current.length > 7200) meterValues.current.shift();
      if (time - lastPaint > 90) { setLevel(Math.max(0, Math.min(1, (db + 60) / 48))); lastPaint = time; }
      meterFrame.current = requestAnimationFrame(sample);
    };
    meterFrame.current = requestAnimationFrame(sample);
  }, []);

  const startRecording = useCallback(async (mode: "command" | "meeting" = "command", consentConfirmed = false) => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setError("Voice recording is not supported here. Type the thought instead."); return; }
    if (mode === "meeting" && !consentConfirmed) { setMeetingConsentOpen(true); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mediaRecorder = new MediaRecorder(stream, mode === "meeting" ? { audioBitsPerSecond: 32_000 } : undefined); chunks.current = [];
      const startedTimestamp = Date.now();
      recordingMode.current = mode; setActiveMode(mode);
      if (mode === "meeting") {
        const localId = `${Date.now()}-${crypto.randomUUID()}`;
        meetingLocalId.current = localId;
        meetingChunkIndex.current = 0;
        await createLocalMeeting({
          localId,
          title: `Meeting ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`,
          startedAt: new Date(startedTimestamp).toISOString(),
          mimeType: mediaRecorder.mimeType || "audio/webm",
        });
        meetingWriteChain.current = Promise.resolve();
        if ("wakeLock" in navigator) {
          void (navigator as Navigator & { wakeLock: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen")
            .then((lock) => { wakeLock.current = lock; })
            .catch(() => undefined);
        }
      }
      mediaRecorder.ondataavailable = (event) => {
        if (!event.data.size) return;
        if (recordingMode.current === "meeting" && meetingLocalId.current) {
          const localId = meetingLocalId.current;
          const index = meetingChunkIndex.current++;
          meetingWriteChain.current = meetingWriteChain.current
            .then(() => saveLocalMeetingChunk(localId, index, event.data));
          void meetingWriteChain.current.then(() => flushMeetingQueue()).catch(() => undefined);
        } else {
          chunks.current.push(event.data);
        }
      };
      mediaRecorder.onstop = async () => {
        const metrics = finishMetering();
        stream.getTracks().forEach((track) => track.stop());
        await wakeLock.current?.release().catch(() => undefined);
        wakeLock.current = null;
        if (recordingMode.current === "meeting" && meetingLocalId.current) {
          const localId = meetingLocalId.current;
          meetingLocalId.current = null;
          setState("processing");
          try {
            await meetingWriteChain.current;
            await finishLocalMeeting(localId, new Date().toISOString(), (Date.now() - startedTimestamp) / 1_000);
            const summary = await flushMeetingQueue();
            await refreshPendingMeetings();
            setNotice(summary.pending
              ? "Meeting is safe on this device. Upload will resume automatically when the connection returns."
              : "Meeting uploaded safely. Speaker-aware processing has started.");
            onSaved();
          } catch (meetingError) {
            await refreshPendingMeetings();
            setNotice("Meeting is safe on this device. Upload recovery is waiting for the connection.");
            void meetingError;
          } finally {
            setState("idle");
          }
          return;
        }
        const blob = new Blob(chunks.current, { type: mediaRecorder.mimeType || "audio/webm" });
        const source = recordingMode.current === "meeting" ? "WEB_MEETING" : "WEB_VOICE";
        const form = new FormData(); form.append("audio", blob, source === "WEB_MEETING" ? "meeting.webm" : "capture.webm"); form.append("current_datetime", dateTimeWithOffset()); form.append("source", source); form.append("diarize", "true");
        if (metrics.averageDb != null) form.append("metering_average_db", String(metrics.averageDb));
        if (metrics.peakDb != null) form.append("metering_peak_db", String(metrics.peakDb));
        if (metrics.variabilityDb != null) form.append("metering_variability_db", String(metrics.variabilityDb));
        void submit(form, source);
      };
      recorder.current = mediaRecorder; mediaRecorder.start(mode === "meeting" ? WEB_MEETING_CHUNK_SECONDS * 1_000 : 1_000); startMetering(stream); setRecordingStartedAt(startedTimestamp); setState("recording"); setError(null); setNotice(null);
    } catch { setError("Microphone access is required to capture your voice."); }
  }, [finishMetering, onSaved, refreshPendingMeetings, startMetering, submit]);

  const toggleRecording = useCallback(async (mode: "command" | "meeting" = "command") => {
    if (recorder.current?.state === "recording") { recorder.current.stop(); return; }
    await startRecording(mode);
  }, [startRecording]);

  const submitText = useCallback(() => { if (draft.trim().length >= 2) void submit({ transcript: draft, current_datetime: dateTimeWithOffset(), source: "WEB_TEXT", processing_mode: "CLOUD" }, "WEB_TEXT"); }, [draft, submit]);
  const importAudio = useCallback((file: File) => { const form = new FormData(); form.append("audio", file, file.name); form.append("current_datetime", dateTimeWithOffset()); form.append("source", "IMPORT"); form.append("diarize", "true"); void submit(form, "IMPORT"); }, [submit]);
  const closeReview = useCallback(() => { setState("idle"); setResult(null); }, []);
  const registerCommandHandler = useCallback((handler: (captureResult: CaptureResponse, source: string) => void) => {
    commandHandler.current = handler;
    return () => { if (commandHandler.current === handler) commandHandler.current = null; };
  }, []);
  useEffect(() => () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    finishMetering();
  }, [finishMetering]);
  useEffect(() => {
    let active = true;
    const recover = async () => {
      const summary = await recoverInterruptedMeetings();
      if (!active) return;
      await refreshPendingMeetings();
      if (summary.uploaded) { setNotice(`${summary.uploaded} recovered meeting${summary.uploaded === 1 ? "" : "s"} uploaded safely.`); onSaved(); }
      else if (summary.pending) setNotice("A saved meeting is waiting for the connection. Upload will resume automatically.");
    };
    void recover().catch(() => void refreshPendingMeetings());
    const onOnline = () => void flushMeetingQueue().then(async (summary) => {
      if (!active) return;
      await refreshPendingMeetings();
      if (summary.uploaded) { setNotice("Recovered meeting uploaded safely. Processing has started."); onSaved(); }
    });
    const preserveRecentAudio = () => {
      if (recordingMode.current === "meeting" && recorder.current?.state === "recording") recorder.current.requestData();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", preserveRecentAudio);
    window.addEventListener("pagehide", preserveRecentAudio);
    return () => {
      active = false;
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", preserveRecentAudio);
      window.removeEventListener("pagehide", preserveRecentAudio);
    };
  }, [onSaved, refreshPendingMeetings]);
  return { state, draft, setDraft, result, error, notice, pendingMeetings, level, recordingStartedAt, activeMode, meetingConsentOpen, toggleRecording, startRecording, submitText, importAudio, closeReview, registerCommandHandler, cancelMeetingConsent: () => setMeetingConsentOpen(false), confirmMeetingConsent: () => { setMeetingConsentOpen(false); void startRecording("meeting", true); } };
}

function interpretWorkspaceCommand(raw: string): {
  page?: WorkspacePage;
  database?: Omit<DatabaseVoiceCommand, "id">;
  openSearch?: boolean;
  startMeeting?: boolean;
  createWorkspace?: string;
  createPage?: string;
  createSubPage?: string;
  editor?: { action: "rename" | "add-block" | "duplicate"; value?: string; blockType?: BlockType };
  locale?: "en" | "ru" | "kk";
  feedback?: string;
  intents: string[];
} {
  const text = raw.toLowerCase().replace(/[.,!?]/g, " ");
  const says = (pattern: RegExp) => pattern.test(text);
  const intents: string[] = [];
  if (says(/(start|begin|record|запусти|начни|записывай|жазуды баста|кездесуді жаз).*(meeting|встреч|созвон|кездесу)/)) {
    return { page: "meetings", startMeeting: true, feedback: localizedFeedback(text, "Meeting recording started", "Запись встречи запущена", "Кездесу жазбасы басталды"), intents: ["Record meeting"] };
  }
  if (says(/(find|search|найди|покажи.*замет|ізде|тауып бер)/)) {
    return { openSearch: true, feedback: localizedFeedback(text, "Voice search opened", "Голосовой поиск открыт", "Дауыстық іздеу ашылды"), intents: ["Search workspace"] };
  }
  if (says(/(switch|change|set|переключ|поменя|установ|ауыстыр).*(language|язык|тіл).*(russian|русск|орыс)/)) return { page: "settings", locale: "ru", feedback: "Интерфейс переключён на русский", intents: ["Update settings", "Change language"] };
  if (says(/(switch|change|set|переключ|поменя|установ|ауыстыр).*(language|язык|тіл).*(kazakh|қазақ|казах)/)) return { page: "settings", locale: "kk", feedback: "Интерфейс қазақ тіліне ауыстырылды", intents: ["Update settings", "Change language"] };
  if (says(/(switch|change|set|переключ|поменя|установ|ауыстыр).*(language|язык|тіл).*(english|англ|ағылшын)/)) return { page: "settings", locale: "en", feedback: "Interface changed to English", intents: ["Update settings", "Change language"] };
  const workspaceMatch = text.match(/(?:create|make|add|создай|создать|добавь|құр|жаса)\s+(?:a\s+)?(?:new\s+)?(?:workspace|рабочее\s+пространство|воркспейс|жұмыс\s+кеңістігі)\s*(?:called|named|с\s+названием|атауы)?\s*([\p{L}\p{N} _-]{2,48})?/u);
  if (workspaceMatch) {
    const name = workspaceMatch[1]?.trim() || "New workspace";
    return { createWorkspace: name, feedback: localizedFeedback(text, `Workspace “${name}” created`, `Рабочее пространство «${name}» создано`, `«${name}» жұмыс кеңістігі құрылды`), intents: ["Create workspace"] };
  }
  const renameMatch = text.match(/(?:rename|переименуй|назови|атын\s+өзгерт)(?:\s+(?:this|current|эту|текущую|осы|ағымдағы))?(?:\s+(?:page|страницу|страница|бет))?\s+(?:to|в|на|деп)\s+[«"]?([\p{L}\p{N} _-]{2,64})[»"]?$/u);
  if (renameMatch) return { editor: { action: "rename", value: renameMatch[1].trim() }, feedback: localizedFeedback(text, `Page renamed to “${renameMatch[1].trim()}”`, `Страница переименована в «${renameMatch[1].trim()}»`, `Бет атауы «${renameMatch[1].trim()}» болып өзгертілді`), intents: ["Rename page"] };
  if (says(/(duplicate|copy|дублируй|скопируй|көшір).*(page|страниц|бет)/)) return { editor: { action: "duplicate" }, feedback: localizedFeedback(text, "Page duplicated", "Страница продублирована", "Бет көшірілді"), intents: ["Duplicate page"] };
  const blockMatch = text.match(/(?:add|create|добавь|создай|қос|жаса)\s+(?:a\s+)?(heading|title|todo|to-do|text|paragraph|заголовок|задачу|текст|абзац|тақырып|тапсырма|мәтін)\s*(.*)$/u);
  if (blockMatch) {
    const named = blockMatch[1];
    const blockType: BlockType = /(heading|title|заголов|тақырып)/.test(named) ? "heading-2" : /(todo|to-do|задач|тапсыр)/.test(named) ? "todo" : "text";
    return { editor: { action: "add-block", blockType, value: blockMatch[2].trim() }, feedback: localizedFeedback(text, "Block added to the current page", "Блок добавлен на текущую страницу", "Блок ағымдағы бетке қосылды"), intents: ["Edit page", "Add block"] };
  }
  const subPageMatch = text.match(/(?:create|make|add|создай|создать|добавь|құр|жаса)\s+(?:a\s+)?(?:new\s+)?(?:subpage|sub-page|подстраницу|вложенную\s+страницу|ішкі\s+бет)\s*(?:called|named|с\s+названием|атауы)?\s*([\p{L}\p{N} _-]{2,64})?/u);
  if (subPageMatch) {
    const name = subPageMatch[1]?.trim() || "Untitled";
    return { createSubPage: name, feedback: localizedFeedback(text, `Sub-page “${name}” created`, `Подстраница «${name}» создана`, `«${name}» ішкі беті құрылды`), intents: ["Create sub-page"] };
  }
  const pageMatch = text.match(/(?:create|make|add|создай|создать|добавь|құр|жаса)\s+(?:a\s+)?(?:new\s+)?(?:page|страницу|страница|бет)\s*(?:called|named|с\s+названием|атауы)?\s*([\p{L}\p{N} _-]{2,64})?/u);
  if (pageMatch) {
    const name = pageMatch[1]?.trim() || "Untitled";
    return { createPage: name, feedback: localizedFeedback(text, `Page “${name}” created`, `Страница «${name}» создана`, `«${name}» беті құрылды`), intents: ["Create page"] };
  }
  if (says(/(create|make|build|сделай|создай|построй|жаса|құр).*(table|database|таблиц|баз.*данн|кесте|дерекқор)/)) {
    const name = says(/(calendar|календар|күнтізбе)/) ? "Content calendar" : says(/(crm|client|клиент)/) ? "Client CRM" : "Voice data";
    return { page: "databases", database: { action: "create-table", name }, feedback: localizedFeedback(text, `Database “${name}” created from your command`, `База «${name}» создана по вашей команде`, `«${name}» дерекқоры пәрмен бойынша құрылды`), intents: ["Create database", "Infer schema"] };
  }
  if (says(/(add|create|добав|создай|қос).*(property|properties|column|field|свойств|колон|поле|баған|өріс)/)) return { page: "databases", database: { action: "add-property" }, feedback: localizedFeedback(text, "Database properties updated", "Свойства базы обновлены", "Дерекқор қасиеттері жаңартылды"), intents: ["Update schema"] };
  if (says(/(group|сгрупп|группируй|топта)/)) return { page: "databases", database: { action: "group" }, feedback: localizedFeedback(text, "Database grouped", "База сгруппирована", "Дерекқор топтастырылды"), intents: ["Group database"] };
  if (says(/(sort|сортир|отсорт|сұрыпта)/)) return { page: "databases", database: { action: "sort" }, feedback: localizedFeedback(text, "Database sorted", "База отсортирована", "Дерекқор сұрыпталды"), intents: ["Sort database"] };
  const view = says(/(board|доск|тақта)/) ? "board" : says(/(timeline|таймлайн|уақыт сызы)/) ? "timeline" : says(/(calendar|календар|күнтізбе)/) ? "calendar" : says(/(chart|diagram|диаграм|график)/) ? "chart" : says(/(table|таблиц|кесте)/) ? "table" : null;
  if (view) {
    intents.push(`Open ${view}`);
    return { page: "databases", database: { action: "view", view }, feedback: localizedFeedback(text, `${view[0].toUpperCase()}${view.slice(1)} view opened`, `Открыто представление «${view}»`, `«${view}» көрінісі ашылды`), intents };
  }
  if (says(/(high priority|высок.*приоритет|жоғары басым)/)) {
    return { page: "databases", database: { action: "filter-high" }, feedback: localizedFeedback(text, "High-priority tasks filtered", "Показаны задачи высокого приоритета", "Жоғары басым тапсырмалар көрсетілді"), intents: ["Filter database"] };
  }
  if (says(/(new row|add row|нов.*строк|добав.*строк|жаңа жол)/)) {
    return { page: "databases", database: { action: "new-row" }, feedback: localizedFeedback(text, "A new database row was created", "Создана новая строка базы", "Дерекқорда жаңа жол құрылды"), intents: ["Create row"] };
  }
  if (says(/(mark|complete|finish|заверш|выполн|готово|аяқта|орындалды)/)) {
    const query = text.replace(/(mark|complete|finish|as done|done|заверши|выполни|готово|аяқта|орындалды|задачу|task)/g, " ").replace(/\s+/g, " ").trim();
    return { page: "databases", database: { action: "complete", query }, feedback: localizedFeedback(text, "The matching task was completed", "Задача отмечена выполненной", "Тапсырма орындалды деп белгіленді"), intents: ["Complete task"] };
  }
  const pages: Array<[RegExp, WorkspacePage, string]> = [
    [/(setting|настрой|баптау)/, "settings", "Settings"],
    [/(knowledge|баз.*знан|білім)/, "memories", "Knowledge"], [/(pattern|паттерн|үлгі)/, "patterns", "Patterns"],
    [/(meeting|встреч|кездесу)/, "meetings", "Meetings"], [/(voice inbox|голосов.*инбокс|дауыс inbox)/, "voice", "Voice inbox"],
    [/(task|задач|тапсыр)/, "tasks", "Tasks"], [/(database|баз.*данн|дерекқор)/, "databases", "Databases"],
    [/(today|сегодня|бүгін)/, "today", "Today"], [/(home|главн|басты бет)/, "home", "Home"],
  ];
  const target = pages.find(([pattern]) => pattern.test(text));
  if (target) return { page: target[1], feedback: localizedFeedback(text, `${target[2]} opened`, `Открыт раздел «${target[2]}»`, `«${target[2]}» бөлімі ашылды`), intents: ["Navigate"] };
  return { intents };
}

function localizedFeedback(text: string, english: string, russian: string, kazakh: string) {
  if (/[әғқңөұүһі]/i.test(text)) return kazakh;
  if (/[а-яё]/i.test(text)) return russian;
  return english;
}

function captureSummary(result: CaptureResponse) {
  const counts = [
    result.parsed.tasks.length ? `${result.parsed.tasks.length} task${result.parsed.tasks.length === 1 ? "" : "s"}` : "",
    result.parsed.habits.length ? `${result.parsed.habits.length} habit event${result.parsed.habits.length === 1 ? "" : "s"}` : "",
    result.parsed.knowledge_base.length ? `${result.parsed.knowledge_base.length} note${result.parsed.knowledge_base.length === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  return counts.length ? `Saved ${counts.join(", ")}` : "Voice capture saved and connected";
}

function latestEnergy(data: DashboardResponse) { return data.captures[0]?.energy_score || Math.round(data.energy.at(-1)?.average || 5); }
function coachObservation(data: DashboardResponse) { const energy = latestEnergy(data); if (energy <= 3) return "Energy is below your baseline. Protect one recovery block before adding work."; if (data.tasks.length > 3) return "Your open-task load is rising. Finish one launch task before capturing another commitment."; return "Morning movement is followed by clearer, more focused captures."; }
function formatDue(value: string) { return new Intl.DateTimeFormat("en", { weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function durationLabel(text: string) { return `${Math.max(2, Math.round(text.split(/\s+/).length / 130))} min`; }
function scrollToId(id: string) { document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }
function dateTimeWithOffset(date = new Date()) {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const pad = (value: number) => String(Math.abs(value)).padStart(2, "0");
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
  return `${local}${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`;
}
