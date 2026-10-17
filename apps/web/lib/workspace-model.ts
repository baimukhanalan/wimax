"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type WorkspaceRecord = { id: string; name: string; members: number };
export type PageKind = "page" | "database";
export type BlockType = "text" | "heading-1" | "heading-2" | "heading-3" | "todo" | "bullet" | "numbered" | "toggle" | "quote" | "callout" | "code" | "divider";
export type BlockStyle = {
  align?: "left" | "center" | "right";
  color?: string;
  background?: string;
  font?: "default" | "serif" | "mono";
  size?: "small" | "default" | "large";
};
export type WorkspaceBlock = { id: string; type: BlockType; content: string; html?: string; checked?: boolean; collapsed?: boolean; detail?: string; language?: string; style?: BlockStyle };
export type WorkspacePageRecord = {
  id: string;
  workspaceId: string;
  parentId: string | null;
  title: string;
  kind: PageKind;
  favorite: boolean;
  archived: boolean;
  expanded: boolean;
  icon: "page" | "database" | "roadmap" | "notes" | "book";
  status: "Not started" | "In progress" | "Done";
  project: string;
  tags: string[];
  blocks: WorkspaceBlock[];
  font?: "default" | "serif" | "mono";
  fontSize?: "small" | "default" | "large";
  fullWidth?: boolean;
  locked?: boolean;
  createdAt: string;
  updatedAt: string;
};

type WorkspaceState = { workspaces: WorkspaceRecord[]; pages: WorkspacePageRecord[] };
const STORAGE_KEY = "wimax.workspace-model.v3";

let seedBlockIndex = 0;
const block = (type: BlockType, content: string, checked?: boolean): WorkspaceBlock => ({ id: `seed-block-${++seedBlockIndex}`, type, content, checked });
const newBlock = (type: BlockType, content = "", checked?: boolean): WorkspaceBlock => ({ id: cryptoId(), type, content, checked });
const timestamp = "2026-08-25T00:00:00.000Z";

const seedState: WorkspaceState = {
  workspaces: [
    { id: "alan", name: "Alan workspace", members: 1 },
    { id: "product-team", name: "Product team", members: 8 },
  ],
  pages: [
    pageSeed("product", "alan", null, "Product", "page", "roadmap", [block("text", "Product strategy, delivery and shared decisions.")]),
    pageSeed("projects", "alan", "product", "Projects", "database", "database", []),
    pageSeed("roadmap", "alan", "product", "Roadmap", "page", "roadmap", [block("heading-2", "Now"), block("todo", "Ship the command-first workspace", true), block("heading-2", "Next"), block("todo", "Invite the beta team")]),
    pageSeed("releases", "alan", "product", "Releases", "page", "notes", [block("heading-1", "Release notes"), block("bullet", "Voice-controlled database views"), block("bullet", "Recoverable meeting capture")]),
    pageSeed("daily-reflections", "alan", null, "Daily reflections", "page", "notes", [block("heading-2", "Today"), block("text", "Energy was stronger after a focused morning block."), block("todo", "Protect two hours for launch work")], true),
    pageSeed("ideas", "alan", null, "Ideas", "page", "page", [block("text", "A voice inbox should feel like a trusted staging area, not another list to maintain.")]),
    pageSeed("reading-list", "alan", null, "Reading list", "page", "book", [block("todo", "Designing Data-Intensive Applications"), block("todo", "Building a Second Brain")]),
    pageSeed("team-handbook", "product-team", null, "Team handbook", "page", "book", [block("heading-1", "How we work"), block("text", "Write decisions down, keep ownership explicit and let voice capture the raw context.")]),
  ],
};

function pageSeed(id: string, workspaceId: string, parentId: string | null, title: string, kind: PageKind, icon: WorkspacePageRecord["icon"], blocks: WorkspaceBlock[], favorite = false): WorkspacePageRecord {
  return { id, workspaceId, parentId, title, kind, favorite, archived: false, expanded: true, icon, status: "In progress", project: "WIMAX", tags: [], blocks, font: "default", fontSize: "default", fullWidth: false, locked: false, createdAt: timestamp, updatedAt: timestamp };
}

function cryptoId() {
  return `local-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function useWorkspaceModel() {
  const [state, setState] = useState<WorkspaceState>(seedState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const restore = window.setTimeout(() => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as WorkspaceState;
          if (parsed.workspaces?.length && Array.isArray(parsed.pages)) setState({ ...parsed, pages: parsed.pages.map((page) => ({ font: "default", fontSize: "default", fullWidth: false, locked: false, ...page, blocks: (page.blocks || []).map((item) => ({ ...item, style: item.style || {} })) })) });
        } catch { /* retain the safe seed */ }
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const createWorkspace = useCallback((name: string) => {
    const clean = name.trim();
    if (!clean) return null;
    const workspace = { id: cryptoId(), name: clean, members: 1 };
    setState((current) => ({ ...current, workspaces: [...current.workspaces, workspace] }));
    return workspace;
  }, []);

  const updateWorkspace = useCallback((id: string, patch: Partial<WorkspaceRecord>) => {
    setState((current) => ({ ...current, workspaces: current.workspaces.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  }, []);

  const createPage = useCallback((workspaceId: string, title = "Untitled", parentId: string | null = null, kind: PageKind = "page") => {
    const now = new Date().toISOString();
    const record: WorkspacePageRecord = {
      id: cryptoId(), workspaceId, parentId, title: title.trim() || "Untitled", kind,
      favorite: false, archived: false, expanded: true, icon: kind === "database" ? "database" : "page",
      status: "Not started", project: "WIMAX", tags: [], blocks: kind === "database" ? [] : [newBlock("text")],
      font: "default", fontSize: "default", fullWidth: false, locked: false,
      createdAt: now, updatedAt: now,
    };
    setState((current) => ({ ...current, pages: [...current.pages.map((page) => page.id === parentId ? { ...page, expanded: true } : page), record] }));
    return record;
  }, []);

  const updatePage = useCallback((id: string, patch: Partial<WorkspacePageRecord>) => {
    setState((current) => ({ ...current, pages: current.pages.map((page) => page.id === id ? { ...page, ...patch, updatedAt: new Date().toISOString() } : page) }));
  }, []);

  const duplicatePage = useCallback((id: string) => {
    const createdId = cryptoId();
    setState((current) => {
      const source = current.pages.find((page) => page.id === id);
      if (!source) return current;
      const duplicate: WorkspacePageRecord = {
        ...source, id: createdId, title: `${source.title} copy`, favorite: false,
        blocks: source.blocks.map((item) => ({ ...item, id: cryptoId() })),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      return { ...current, pages: [...current.pages, duplicate] };
    });
    return createdId;
  }, []);

  const archivePage = useCallback((id: string) => {
    setState((current) => {
      const descendants = new Set<string>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        current.pages.forEach((page) => { if (page.parentId && descendants.has(page.parentId) && !descendants.has(page.id)) { descendants.add(page.id); changed = true; } });
      }
      return { ...current, pages: current.pages.map((page) => descendants.has(page.id) ? { ...page, archived: true } : page) };
    });
  }, []);

  const movePage = useCallback((id: string, parentId: string | null) => updatePage(id, { parentId }), [updatePage]);
  const pagesByWorkspace = useMemo(() => (workspaceId: string) => state.pages.filter((page) => page.workspaceId === workspaceId && !page.archived), [state.pages]);

  return { ...state, hydrated, createWorkspace, updateWorkspace, createPage, updatePage, duplicatePage, archivePage, movePage, pagesByWorkspace };
}
