"use client";

import type { DashboardResponse } from "@cognitive-mirror/contracts";
import {
  ArrowDownUp, BarChart3, CalendarDays, Check, ChevronDown, CircleDot, Columns3,
  Database, Filter, GanttChartSquare, Group, ListFilter, MoreHorizontal,
  Plus, Search, Settings2, Table2, Users, X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "./locale";

export type DatabaseView = "table" | "board" | "timeline" | "calendar" | "chart";
export type DatabaseVoiceCommand = { id: number; action: "view" | "filter-high" | "new-row" | "complete" | "create-table" | "add-property" | "group" | "sort"; view?: DatabaseView; query?: string; name?: string };
type DatabaseRow = {
  id: string; name: string; status: "Not started" | "In progress" | "In review" | "Done";
  owner: string; project: string; due: string; priority: "Low" | "Medium" | "High";
  progress: number; relation: string; notes?: string; custom?: Record<string, string | number | boolean>;
};
type CustomProperty = { id: string; name: string; type: "text" | "number" | "select" | "checkbox" };

const fallbackRows: DatabaseRow[] = [
  { id: "seed-1", name: "Finalize onboarding flow", status: "In progress", owner: "Alan", project: "WIMAX launch", due: "2026-08-27", priority: "High", progress: 68, relation: "Onboarding epic" },
  { id: "seed-2", name: "Create product tour video", status: "In review", owner: "Dana", project: "WIMAX launch", due: "2026-08-28", priority: "Medium", progress: 85, relation: "Marketing assets" },
  { id: "seed-3", name: "Implement analytics events", status: "In progress", owner: "Alan", project: "Mobile beta", due: "2026-08-30", priority: "High", progress: 42, relation: "Analytics tracking" },
  { id: "seed-4", name: "Write help center articles", status: "Not started", owner: "Mira", project: "Knowledge base", due: "2026-09-02", priority: "Medium", progress: 0, relation: "Support launch" },
  { id: "seed-5", name: "Beta feedback sync", status: "In review", owner: "Dana", project: "Mobile beta", due: "2026-09-03", priority: "Medium", progress: 75, relation: "Beta feedback" },
  { id: "seed-6", name: "Performance optimization", status: "Not started", owner: "Mira", project: "Web workspace", due: "2026-09-06", priority: "Low", progress: 10, relation: "Technical debt" },
];

function rowsFromDashboard(data: DashboardResponse): DatabaseRow[] {
  if (!data.tasks.length) return fallbackRows;
  return data.tasks.slice(0, 12).map((task, index) => ({
    id: task.id,
    name: task.title,
    status: task.status === "COMPLETED" ? "Done" : task.priority === "HIGH" ? "In progress" : "Not started",
    owner: ["Alan", "Dana", "Mira"][index % 3],
    project: task.project || "Inbox",
    due: task.due_date?.slice(0, 10) || `2026-09-${String(2 + index).padStart(2, "0")}`,
    priority: task.priority === "URGENT" || task.priority === "HIGH" ? "High" : task.priority === "LOW" ? "Low" : "Medium",
    progress: task.status === "COMPLETED" ? 100 : [68, 42, 25, 80][index % 4],
    relation: task.action_items[0] || "Voice capture",
  }));
}

export function WorkspaceDatabaseStudio({ data, voiceCommand, databaseId = "projects", initialName = "Projects", onRename }: {
  data: DashboardResponse; voiceCommand?: DatabaseVoiceCommand | null; databaseId?: string; initialName?: string; onRename?: (title: string) => void;
}) {
  const { t } = useLocale();
  const [rows, setRows] = useState<DatabaseRow[]>(() => rowsFromDashboard(data));
  const [view, setView] = useState<DatabaseView>("table");
  const [databaseName, setDatabaseName] = useState(initialName);
  const [query, setQuery] = useState("");
  const [highOnly, setHighOnly] = useState(false);
  const [descending, setDescending] = useState(false);
  const [grouped, setGrouped] = useState(false);
  const [showRelation, setShowRelation] = useState(true);
  const [propertyMenuOpen, setPropertyMenuOpen] = useState(false);
  const [customProperties, setCustomProperties] = useState<CustomProperty[]>([]);
  const [newPropertyName, setNewPropertyName] = useState("");
  const [newPropertyType, setNewPropertyType] = useState<CustomProperty["type"]>("text");
  const [selectedRow, setSelectedRow] = useState<DatabaseRow | null>(null);
  const [storageReadyFor, setStorageReadyFor] = useState("");

  useEffect(() => {
    const restoreRows = window.setTimeout(() => {
      const stored = localStorage.getItem(`wimax.database.${databaseId}.rows.v2`);
      const storedProperties = localStorage.getItem(`wimax.database.${databaseId}.properties.v1`);
      let nextRows = rowsFromDashboard(data);
      let nextProperties: CustomProperty[] = [];
      if (stored) {
        try { nextRows = JSON.parse(stored) as DatabaseRow[]; } catch { /* keep server-backed rows */ }
      }
      if (storedProperties) {
        try { nextProperties = JSON.parse(storedProperties) as CustomProperty[]; } catch { /* keep defaults */ }
      }
      setRows(nextRows);
      setCustomProperties(nextProperties);
      setDatabaseName(initialName);
      setStorageReadyFor(databaseId);
    }, 0);
    return () => window.clearTimeout(restoreRows);
  }, [data, databaseId, initialName]);
  useEffect(() => { if (storageReadyFor === databaseId) localStorage.setItem(`wimax.database.${databaseId}.rows.v2`, JSON.stringify(rows)); }, [databaseId, rows, storageReadyFor]);
  useEffect(() => { if (storageReadyFor === databaseId) localStorage.setItem(`wimax.database.${databaseId}.properties.v1`, JSON.stringify(customProperties)); }, [customProperties, databaseId, storageReadyFor]);
  useEffect(() => {
    if (!voiceCommand) return;
    const applyVoiceCommand = window.setTimeout(() => {
      if (voiceCommand.action === "view" && voiceCommand.view) setView(voiceCommand.view);
      if (voiceCommand.action === "filter-high") setHighOnly(true);
      if (voiceCommand.action === "new-row") addRow();
      if (voiceCommand.action === "create-table") {
        setDatabaseName(voiceCommand.name || "Untitled database");
        setRows([]);
        setView("table");
      }
      if (voiceCommand.action === "add-property") {
        setShowRelation(true);
        setCustomProperties((current) => current.some((property) => property.name === (voiceCommand.name || "Notes")) ? current : [...current, { id: `property-${Date.now()}`, name: voiceCommand.name || "Notes", type: "text" }]);
      }
      if (voiceCommand.action === "group") setGrouped(true);
      if (voiceCommand.action === "sort") setDescending(true);
      if (voiceCommand.action === "complete") {
        const needle = (voiceCommand.query || "").toLowerCase();
        setRows((current) => current.map((row) => !needle || row.name.toLowerCase().includes(needle) ? { ...row, status: "Done", progress: 100 } : row));
      }
    }, 0);
    return () => window.clearTimeout(applyVoiceCommand);
  }, [voiceCommand]);

  const visibleRows = useMemo(() => rows
    .filter((row) => !highOnly || row.priority === "High")
    .filter((row) => `${row.name} ${row.project} ${row.owner}`.toLowerCase().includes(query.trim().toLowerCase()))
    .toSorted((a, b) => descending ? b.due.localeCompare(a.due) : a.due.localeCompare(b.due)), [rows, query, highOnly, descending]);

  function updateRow(id: string, patch: Partial<DatabaseRow>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  }
  function addRow() {
    const id = `local-${Date.now()}`;
    setRows((current) => [...current, { id, name: "Untitled task", status: "Not started", owner: "Alan", project: "Inbox", due: new Date().toISOString().slice(0, 10), priority: "Medium", progress: 0, relation: "" }]);
    setView("table");
  }
  function addProperty() {
    const name = newPropertyName.trim();
    if (!name || customProperties.some((property) => property.name.toLowerCase() === name.toLowerCase())) return;
    setCustomProperties((current) => [...current, { id: `property-${crypto.randomUUID()}`, name, type: newPropertyType }]);
    setNewPropertyName("");
  }
  function updateCustomValue(rowId: string, propertyId: string, value: string | number | boolean) {
    setRows((current) => current.map((row) => row.id === rowId ? { ...row, custom: { ...(row.custom || {}), [propertyId]: value } } : row));
  }

  return <div className="database-studio">
      <header className="studio-heading studio-heading--database"><div><span className="studio-page-icon"><Database /></span><p>Alan workspace / Product</p></div><input aria-label="Database title" value={databaseName} onChange={(event) => { setDatabaseName(event.target.value); onRename?.(event.target.value); }} /><span>Track initiatives, owners, progress and delivery.</span></header>
      <section className="studio-database">
        <div className="studio-toolbar">
          <div className="studio-views">
            {(["table", "board", "timeline", "calendar", "chart"] as DatabaseView[]).map((value) => {
              const Icon = value === "table" ? Table2 : value === "board" ? Columns3 : value === "timeline" ? GanttChartSquare : value === "calendar" ? CalendarDays : BarChart3;
              return <button key={value} className={view === value ? "is-active" : ""} onClick={() => setView(value)}><Icon />{t(`db.${value}`, value[0].toUpperCase() + value.slice(1))}</button>;
            })}
          </div>
          <div className="studio-tools">
            <button className={highOnly ? "is-active" : ""} onClick={() => setHighOnly((value) => !value)}><Filter />{t("db.filter", "Filter")}</button>
            <button className={descending ? "is-active" : ""} onClick={() => setDescending((value) => !value)}><ArrowDownUp />{t("db.sort", "Sort")}</button>
            <button className={grouped ? "is-active" : ""} onClick={() => setGrouped((value) => !value)}><Group />{t("db.group", "Group")}</button>
            <button className={propertyMenuOpen ? "is-active" : ""} onClick={() => setPropertyMenuOpen((value) => !value)}><Settings2 />{t("db.properties", "Properties")}</button>
            <label><Search /><input aria-label="Search database" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("db.search", "Search")} /></label>
            <button className="studio-new" onClick={addRow}><Plus />{t("db.new", "New")}<ChevronDown /></button>
          </div>
        </div>
        {propertyMenuOpen ? <div className="database-property-menu"><header><strong>Properties</strong><button onClick={() => setPropertyMenuOpen(false)} aria-label="Close properties"><X /></button></header><label><input type="checkbox" checked readOnly />Name</label><label><input type="checkbox" checked readOnly />Status</label><label><input type="checkbox" checked={showRelation} onChange={(event) => setShowRelation(event.target.checked)} />Relation</label>{customProperties.map((property) => <div className="database-property-item" key={property.id}><span>{property.name}<small>{property.type}</small></span><button onClick={() => setCustomProperties((current) => current.filter((item) => item.id !== property.id))} aria-label={`Delete ${property.name}`}><X /></button></div>)}<div className="database-property-create"><input aria-label="Property name" value={newPropertyName} onChange={(event) => setNewPropertyName(event.target.value)} placeholder="Property name" /><select aria-label="Property type" value={newPropertyType} onChange={(event) => setNewPropertyType(event.target.value as CustomProperty["type"])}><option value="text">Text</option><option value="number">Number</option><option value="select">Select</option><option value="checkbox">Checkbox</option></select><button onClick={addProperty} disabled={!newPropertyName.trim()}><Plus />Add</button></div></div> : null}
        <DatabaseSurface view={view} rows={visibleRows} grouped={grouped} showRelation={showRelation} customProperties={customProperties} updateRow={updateRow} updateCustomValue={updateCustomValue} onOpenRow={setSelectedRow} />
      </section>
      {selectedRow ? <RowPage row={selectedRow} onClose={() => setSelectedRow(null)} onChange={(patch) => { updateRow(selectedRow.id, patch); setSelectedRow((current) => current ? { ...current, ...patch } : current); }} /> : null}
  </div>;
}

function DatabaseSurface({ view, rows, grouped, showRelation, customProperties, updateRow, updateCustomValue, onOpenRow }: {
  view: DatabaseView; rows: DatabaseRow[]; grouped: boolean; showRelation: boolean; customProperties: CustomProperty[];
  updateRow: (id: string, patch: Partial<DatabaseRow>) => void;
  updateCustomValue: (rowId: string, propertyId: string, value: string | number | boolean) => void;
  onOpenRow: (row: DatabaseRow) => void;
}) {
  const { t } = useLocale();
  if (view === "chart") return <WorkspaceAnalytics rows={rows} embedded />;
  if (view === "board") return <div className="studio-board">{(["Not started", "In progress", "In review", "Done"] as const).map((status) => <section key={status}><header><CircleDot /><strong>{status}</strong><span>{rows.filter((row) => row.status === status).length}</span></header>{rows.filter((row) => row.status === status).map((row) => <article key={row.id}><strong>{row.name}</strong><span>{row.project}</span><footer><em className={`priority priority--${row.priority.toLowerCase()}`}>{row.priority}</em><b>{row.progress}%</b></footer></article>)}</section>)}</div>;
  if (view === "timeline") return <div className="studio-timeline"><header><span>Task</span>{["25 Aug", "28 Aug", "31 Aug", "3 Sep", "6 Sep"].map((date) => <span key={date}>{date}</span>)}</header>{rows.map((row, index) => <div key={row.id}><strong>{row.name}</strong><i style={{ gridColumn: `${2 + (index % 3)} / span ${Math.max(1, Math.round(row.progress / 35))}` }}><span>{row.progress}%</span></i></div>)}</div>;
  if (view === "calendar") return <div className="studio-calendar">{Array.from({ length: 35 }, (_, index) => { const day = index - 3; const items = rows.filter((_, rowIndex) => (rowIndex * 3 + 7) % 28 === day); return <div key={index} className={day < 1 || day > 30 ? "is-muted" : ""}><span>{day > 0 && day <= 30 ? day : ""}</span>{items.map((row) => <strong key={row.id}>{row.name}</strong>)}</div>; })}</div>;
  const gridTemplate = `minmax(240px,1.8fr) 120px 120px 140px 105px 90px 125px ${showRelation ? "minmax(150px,1fr)" : ""} ${customProperties.map(() => "140px").join(" ")} 35px`;
  const renderRows = (items: DatabaseRow[]) => <>{items.map((row) => <div className="studio-tr" style={{ gridTemplateColumns: gridTemplate }} key={row.id}>
    <span><input type="checkbox" aria-label={`Select ${row.name}`} /><button className="row-open" onClick={() => onOpenRow(row)}>{row.name}</button></span>
    <span><select value={row.status} onChange={(event) => updateRow(row.id, { status: event.target.value as DatabaseRow["status"] })}><option>Not started</option><option>In progress</option><option>In review</option><option>Done</option></select></span>
    <span><i className="owner-avatar">{row.owner.slice(0, 2).toUpperCase()}</i>{row.owner}</span><span>{row.project}</span><span>{row.due}</span><span><em className={`priority priority--${row.priority.toLowerCase()}`}>{row.priority}</em></span><span><i className="progress-track"><b style={{ width: `${row.progress}%` }} /></i>{row.progress}%</span>{showRelation ? <span>{row.relation || "—"}</span> : null}{customProperties.map((property) => <span className="custom-property-cell" key={property.id}>{property.type === "checkbox" ? <input type="checkbox" aria-label={`${property.name} for ${row.name}`} checked={Boolean(row.custom?.[property.id])} onChange={(event) => updateCustomValue(row.id, property.id, event.target.checked)} /> : property.type === "select" ? <select aria-label={`${property.name} for ${row.name}`} value={String(row.custom?.[property.id] || "")} onChange={(event) => updateCustomValue(row.id, property.id, event.target.value)}><option value="">Empty</option><option>Option 1</option><option>Option 2</option></select> : <input aria-label={`${property.name} for ${row.name}`} type={property.type === "number" ? "number" : "text"} value={String(row.custom?.[property.id] ?? "")} onChange={(event) => updateCustomValue(row.id, property.id, property.type === "number" ? Number(event.target.value) : event.target.value)} placeholder="Empty" />}</span>)}<button aria-label={`Open ${row.name} details`} onClick={() => onOpenRow(row)}><MoreHorizontal /></button>
  </div>)}</>;
  const groups = Array.from(new Set(rows.map((row) => row.project)));
  return <div className={`studio-table ${showRelation ? "" : "studio-table--compact"}`}><div className="studio-tr studio-th" style={{ gridTemplateColumns: gridTemplate }}><span>{t("db.name", "Name")}</span><span>{t("db.status", "Status")}</span><span>{t("db.owner", "Owner")}</span><span>{t("db.project", "Project")}</span><span>{t("db.due", "Due")}</span><span>{t("db.priority", "Priority")}</span><span>{t("db.progress", "Progress")}</span>{showRelation ? <span>{t("db.relation", "Relation")}</span> : null}{customProperties.map((property) => <span key={property.id}>{property.name}</span>)}<span /></div>{grouped ? groups.map((group) => <section className="table-group" key={group}><header><ChevronDown />{group}<span>{rows.filter((row) => row.project === group).length}</span></header>{renderRows(rows.filter((row) => row.project === group))}</section>) : renderRows(rows)}</div>;
}

function RowPage({ row, onClose, onChange }: { row: DatabaseRow; onClose: () => void; onChange: (patch: Partial<DatabaseRow>) => void }) {
  return <div className="row-page-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><article className="row-page" role="dialog" aria-modal="true" aria-label={`${row.name} page`}><header><span>Database item</span><button onClick={onClose} aria-label="Close row page"><X /></button></header><input className="row-page-title" value={row.name} onChange={(event) => onChange({ name: event.target.value })} /><div className="row-page-properties"><label>Status<select value={row.status} onChange={(event) => onChange({ status: event.target.value as DatabaseRow["status"] })}><option>Not started</option><option>In progress</option><option>In review</option><option>Done</option></select></label><label>Owner<input value={row.owner} onChange={(event) => onChange({ owner: event.target.value })} /></label><label>Project<input value={row.project} onChange={(event) => onChange({ project: event.target.value })} /></label><label>Due<input type="date" value={row.due} onChange={(event) => onChange({ due: event.target.value })} /></label><label>Priority<select value={row.priority} onChange={(event) => onChange({ priority: event.target.value as DatabaseRow["priority"] })}><option>Low</option><option>Medium</option><option>High</option></select></label><label>Progress<input type="range" min="0" max="100" value={row.progress} onChange={(event) => onChange({ progress: Number(event.target.value) })} /><span>{row.progress}%</span></label></div><textarea value={row.notes ?? ""} placeholder={`Add notes, decisions and connected voice captures for ${row.name}…`} onChange={(event) => onChange({ notes: event.target.value })} aria-label="Page content" /></article></div>;
}

function WorkspaceAnalytics({ rows, compact = false, embedded = false }: { rows: DatabaseRow[]; compact?: boolean; embedded?: boolean }) {
  const { t } = useLocale();
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const completed = rows.filter((row) => row.status === "Done").length;
  const completion = rows.length ? Math.round((completed / rows.length) * 100) : 0;
  const owners = Array.from(new Set(rows.map((row) => row.owner))).map((owner) => ({ owner, count: rows.filter((row) => row.owner === owner).length }));
  const points = [18, 25, 28, 36, 44, 43, 51, 56, 61, Math.max(64, completion)];
  return <section className={`workspace-analytics ${compact ? "is-compact" : ""} ${embedded ? "is-embedded" : ""}`}>
    <header><div><BarChart3 /><strong>{t("analytics.title", "Analytics")}</strong><span>{t("analytics.subtitle", "Overview of progress and workload")}</span></div><button onClick={() => setPeriod((value) => value === 7 ? 30 : value === 30 ? 90 : 7)}>Last {period} days <ChevronDown /></button></header>
    <div className="analytics-grid">
      <article className="line-chart"><h3>{t("analytics.progress", "Progress over time")}</h3><svg viewBox="0 0 360 170" role="img" aria-label="Progress over time"><path className="chart-grid" d="M25 20H345M25 60H345M25 100H345M25 140H345" /><polyline points={points.map((point, index) => `${25 + index * 35},${150 - point * 1.25}`).join(" ")} /><g>{points.map((point, index) => <circle key={index} cx={25 + index * 35} cy={150 - point * 1.25} r="3" />)}</g></svg><footer><span>25 Aug</span><span>8 Sep</span><span>24 Sep</span></footer></article>
      <article className="workload-chart"><h3>{t("analytics.workload", "Workload by owner")}</h3>{owners.map(({ owner, count }) => <div key={owner}><span>{owner}</span><i><b style={{ width: `${Math.min(100, count * 28)}%` }} /></i><strong>{count}</strong></div>)}</article>
      <article className="donut-chart"><h3>{t("analytics.completion", "Completion rate")}</h3><div style={{ "--completion": `${completion * 3.6}deg` } as React.CSSProperties}><span><strong>{completion}%</strong>{t("analytics.completion", "Completed")}</span></div><footer><span><i />Done <b>{completed}</b></span><span><i />In progress <b>{rows.length - completed}</b></span></footer></article>
      <article className="metric-stack"><h3>{t("analytics.metrics", "Key metrics")}</h3><div><ListFilter /><span>Total tasks<strong>{rows.length}</strong></span></div><div><Check /><span>Completed<strong>{completed}</strong></span></div><div><Users /><span>Owners<strong>{owners.length}</strong></span></div><div><CalendarDays /><span>On track<strong>{Math.round(rows.reduce((sum, row) => sum + row.progress, 0) / Math.max(1, rows.length))}%</strong></span></div></article>
    </div>
  </section>;
}
