"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter, AlignLeft, AlignRight, Bold, CheckSquare, ChevronDown, ChevronRight,
  Code2, Copy, GripVertical, Heading1, Heading2, Heading3, Highlighter, Italic, Link2,
  List, ListOrdered, Lock, Maximize2, MessageSquareQuote, Mic, MoreHorizontal, Palette,
  Plus, Quote, Redo2, Settings2, Star, Strikethrough, Trash2, Type, Underline, Undo2,
  Unlock, X,
} from "lucide-react";
import type { BlockStyle, BlockType, WorkspaceBlock, WorkspacePageRecord } from "@/lib/workspace-model";
import type { VoiceCaptureController } from "./voice-command-center";

type Props = {
  page: WorkspacePageRecord;
  capture: VoiceCaptureController;
  onChange: (patch: Partial<WorkspacePageRecord>) => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onCreateChild: () => void;
};

const blockTypes: Array<{ type: BlockType; label: string; copy: string; icon: typeof Type; shortcut?: string }> = [
  { type: "text", label: "Text", copy: "Plain rich-text block", icon: Type, shortcut: "⌘⌥0" },
  { type: "heading-1", label: "Heading 1", copy: "Large section heading", icon: Heading1, shortcut: "⌘⌥1" },
  { type: "heading-2", label: "Heading 2", copy: "Medium section heading", icon: Heading2, shortcut: "⌘⌥2" },
  { type: "heading-3", label: "Heading 3", copy: "Small section heading", icon: Heading3, shortcut: "⌘⌥3" },
  { type: "todo", label: "To-do list", copy: "Track an action", icon: CheckSquare },
  { type: "bullet", label: "Bulleted list", copy: "Create a simple list", icon: List },
  { type: "numbered", label: "Numbered list", copy: "Create an ordered list", icon: ListOrdered },
  { type: "toggle", label: "Toggle list", copy: "Hide supporting details", icon: ChevronRight },
  { type: "quote", label: "Quote", copy: "Capture an important passage", icon: Quote },
  { type: "callout", label: "Callout", copy: "Highlight useful context", icon: MessageSquareQuote },
  { type: "code", label: "Code", copy: "Formatted code block", icon: Code2 },
  { type: "divider", label: "Divider", copy: "Separate sections", icon: MoreHorizontal },
];

const textColors = ["#211e1a", "#78736c", "#b94716", "#a03423", "#28664b", "#245c8a", "#6a4c93"];
const backgrounds = ["transparent", "#f0ebe2", "#fff0e8", "#fbe9e5", "#e8f2ec", "#eaf0f7", "#efe9f6"];

export function WorkspacePageEditor({ page, capture, onChange, onDuplicate, onArchive, onCreateChild }: Props) {
  const [menuAfter, setMenuAfter] = useState<string | "end" | null>(null);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [formatOpen, setFormatOpen] = useState<"color" | "background" | null>(null);
  const [historyState, setHistoryState] = useState({ undo: 0, redo: 0 });
  const dragId = useRef<string | null>(null);
  const savedRange = useRef<Range | null>(null);
  const undoStack = useRef<WorkspaceBlock[][]>([]);
  const redoStack = useRef<WorkspaceBlock[][]>([]);
  const historyAt = useRef(0);
  const blocks = page.blocks;

  useEffect(() => {
    const rememberSelection = () => {
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      const range = selection.getRangeAt(0);
      const node = range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
      if (node?.closest("[data-rich-block]")) savedRange.current = range.cloneRange();
    };
    document.addEventListener("selectionchange", rememberSelection);
    return () => document.removeEventListener("selectionchange", rememberSelection);
  }, []);

  const commitBlocks = useCallback((next: WorkspaceBlock[], record = true) => {
    if (record) {
      const now = Date.now();
      if (now - historyAt.current > 450) undoStack.current = [...undoStack.current.slice(-99), structuredClone(blocks)];
      historyAt.current = now;
      redoStack.current = [];
      setHistoryState({ undo: undoStack.current.length, redo: 0 });
    }
    onChange({ blocks: next });
  }, [blocks, onChange]);

  const undo = useCallback(() => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push(structuredClone(blocks));
    setHistoryState({ undo: undoStack.current.length, redo: redoStack.current.length });
    onChange({ blocks: previous });
  }, [blocks, onChange]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(structuredClone(blocks));
    setHistoryState({ undo: undoStack.current.length, redo: redoStack.current.length });
    onChange({ blocks: next });
  }, [blocks, onChange]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [redo, undo]);

  const updateBlock = (id: string, patch: Partial<WorkspaceBlock>, record = true) => commitBlocks(blocks.map((item) => item.id === id ? { ...item, ...patch } : item), record);
  const removeBlock = (id: string) => commitBlocks(blocks.filter((item) => item.id !== id));
  const duplicateBlock = (id: string) => {
    const index = blocks.findIndex((item) => item.id === id);
    if (index < 0) return;
    const duplicate = { ...structuredClone(blocks[index]), id: `block-${crypto.randomUUID()}` };
    commitBlocks([...blocks.slice(0, index + 1), duplicate, ...blocks.slice(index + 1)]);
  };
  const moveBlock = (id: string, direction: -1 | 1) => {
    const index = blocks.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= blocks.length) return;
    const next = [...blocks]; [next[index], next[target]] = [next[target]!, next[index]!]; commitBlocks(next);
  };
  const addBlock = (type: BlockType, after: string | "end" | null = "end") => {
    const next: WorkspaceBlock = { id: `block-${crypto.randomUUID()}`, type, content: "", checked: type === "todo" ? false : undefined, collapsed: type === "toggle" ? false : undefined, language: type === "code" ? "Plain text" : undefined, style: {} };
    const index = after === "end" || after == null ? blocks.length : blocks.findIndex((item) => item.id === after) + 1;
    commitBlocks([...blocks.slice(0, index), next, ...blocks.slice(index)]);
    setMenuAfter(null);
    window.setTimeout(() => document.querySelector<HTMLElement>(`[data-block-id="${next.id}"] [data-rich-block], [data-block-id="${next.id}"] textarea`)?.focus(), 0);
  };
  const reorder = (targetId: string) => {
    const sourceId = dragId.current;
    if (!sourceId || sourceId === targetId) return;
    const source = blocks.find((item) => item.id === sourceId);
    if (!source) return;
    const without = blocks.filter((item) => item.id !== sourceId);
    const targetIndex = without.findIndex((item) => item.id === targetId);
    commitBlocks([...without.slice(0, targetIndex), source, ...without.slice(targetIndex)]);
  };
  const addTag = () => {
    const value = tagDraft.trim();
    if (!value || page.tags.includes(value)) return;
    onChange({ tags: [...page.tags, value] }); setTagDraft("");
  };
  const activeBlock = blocks.find((item) => item.id === activeBlockId) || null;
  const styleBlock = (patch: Partial<BlockStyle>) => activeBlock && updateBlock(activeBlock.id, { style: { ...activeBlock.style, ...patch } });
  const transformActiveBlock = (type: BlockType) => activeBlock && updateBlock(activeBlock.id, { type });
  const applyInline = (command: string, value?: string) => {
    const range = savedRange.current;
    if (!range || range.collapsed || !activeBlock) return;
    const origin = range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    const element = origin?.closest("[data-rich-block]") as HTMLElement | null;
    if (!element) return;
    const tag = command === "bold" ? "strong" : command === "italic" ? "em" : command === "underline" ? "u" : command === "strikeThrough" ? "s" : command === "createLink" ? "a" : "span";
    const wrapper = document.createElement(tag);
    if (tag === "a" && value) { wrapper.setAttribute("href", value); wrapper.setAttribute("target", "_blank"); wrapper.setAttribute("rel", "noreferrer"); }
    wrapper.append(range.extractContents());
    range.insertNode(wrapper);
    range.selectNodeContents(wrapper);
    const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
    savedRange.current = range.cloneRange();
    updateBlock(activeBlock.id, { content: element.innerText, html: sanitizeRichHtml(element.innerHTML) }, false);
  };
  const createLink = () => {
    const url = window.prompt("Paste a URL");
    if (url) applyInline("createLink", /^https?:\/\//i.test(url) ? url : `https://${url}`);
  };
  const wordCount = useMemo(() => blocks.reduce((sum, item) => sum + item.content.trim().split(/\s+/).filter(Boolean).length, 0), [blocks]);
  const documentClass = `workspace-document workspace-document--blocks page-font--${page.font || "default"} page-size--${page.fontSize || "default"} ${page.fullWidth ? "is-full-width" : ""} ${page.locked ? "is-locked" : ""}`;

  return <article className={documentClass}>
    <div className="document-cover"><div className="cover-wordmark">WIMAX</div><button onClick={() => void capture.toggleRecording()}><Mic /> Capture into this page</button></div>
    <div className="document-body">
      <header className="document-page-tools">
        <button onClick={undo} disabled={!historyState.undo} title="Undo"><Undo2 /></button><button onClick={redo} disabled={!historyState.redo} title="Redo"><Redo2 /></button><span className="document-tool-separator" />
        <button onClick={() => onChange({ favorite: !page.favorite })} className={page.favorite ? "is-active" : ""}><Star />{page.favorite ? "Favorited" : "Favorite"}</button><button onClick={onCreateChild} disabled={page.locked}><Plus />Sub-page</button><button onClick={() => setPageMenuOpen((value) => !value)} aria-label="Page settings"><Settings2 />Customize</button>
        {pageMenuOpen ? <PageSettings page={page} onChange={onChange} onDuplicate={() => { onDuplicate(); setPageMenuOpen(false); }} onArchive={() => { onArchive(); setPageMenuOpen(false); }} /> : null}
      </header>
      <input className="document-title" aria-label="Page title" value={page.title} readOnly={page.locked} onChange={(event) => onChange({ title: event.target.value })} />
      <div className="document-properties document-properties--editable">
        <span>Status</span><select disabled={page.locked} aria-label="Page status" value={page.status} onChange={(event) => onChange({ status: event.target.value as WorkspacePageRecord["status"] })}><option>Not started</option><option>In progress</option><option>Done</option></select>
        <span>Project</span><input readOnly={page.locked} aria-label="Page project" value={page.project} onChange={(event) => onChange({ project: event.target.value })} />
        <span>Tags</span><div className="document-tags">{page.tags.map((tag) => <button disabled={page.locked} key={tag} onClick={() => onChange({ tags: page.tags.filter((item) => item !== tag) })}>{tag}<X /></button>)}<input readOnly={page.locked} aria-label="Add tag" value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addTag(); }} placeholder="Add tag" /></div>
      </div>
      <FormattingToolbar activeBlock={activeBlock} onInline={applyInline} onLink={createLink} onStyle={styleBlock} onTransform={transformActiveBlock} formatOpen={formatOpen} setFormatOpen={setFormatOpen} disabled={Boolean(page.locked)} />
      <section className="block-editor" aria-label="Page blocks">
        {blocks.map((item, index) => <BlockRow key={item.id} block={item} number={index + 1} locked={Boolean(page.locked)} active={activeBlockId === item.id} onActivate={() => setActiveBlockId(item.id)} onChange={(patch, record) => updateBlock(item.id, patch, record)} onRemove={() => removeBlock(item.id)} onDuplicate={() => duplicateBlock(item.id)} onMove={(direction) => moveBlock(item.id, direction)} onAdd={() => setMenuAfter(item.id)} onCreateText={() => addBlock("text", item.id)} onTransform={(type) => updateBlock(item.id, { type })} onDragStart={() => { dragId.current = item.id; }} onDrop={() => reorder(item.id)} />)}
        {!page.locked ? <button className="block-add" onClick={() => setMenuAfter("end")}><Plus /> Add a block</button> : null}
        {menuAfter && !page.locked ? <BlockMenu onChoose={(type) => addBlock(type, menuAfter)} onClose={() => setMenuAfter(null)} /> : null}
      </section>
      <footer className="document-status"><span>{page.locked ? "Page locked" : "Saved locally"}</span><span>{blocks.length} blocks · {wordCount} words</span></footer>
    </div>
  </article>;
}

function FormattingToolbar({ activeBlock, onInline, onLink, onStyle, onTransform, formatOpen, setFormatOpen, disabled }: {
  activeBlock: WorkspaceBlock | null; onInline: (command: string, value?: string) => void; onLink: () => void; onStyle: (patch: Partial<BlockStyle>) => void; onTransform: (type: BlockType) => void; formatOpen: "color" | "background" | null; setFormatOpen: (value: "color" | "background" | null) => void; disabled: boolean;
}) {
  const action = (callback: () => void) => (event: React.MouseEvent) => { event.preventDefault(); callback(); };
  return <div className={`editor-format-toolbar ${activeBlock ? "is-active" : ""}`} aria-label="Text formatting toolbar">
    <select aria-label="Block type" disabled={disabled || !activeBlock} value={activeBlock?.type || "text"} onChange={(event) => onTransform(event.target.value as BlockType)}>{blockTypes.filter((item) => item.type !== "divider").map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}</select>
    <button disabled={disabled || !activeBlock} onMouseDown={action(() => onInline("bold"))} title="Bold"><Bold /></button><button disabled={disabled || !activeBlock} onMouseDown={action(() => onInline("italic"))} title="Italic"><Italic /></button><button disabled={disabled || !activeBlock} onMouseDown={action(() => onInline("underline"))} title="Underline"><Underline /></button><button disabled={disabled || !activeBlock} onMouseDown={action(() => onInline("strikeThrough"))} title="Strikethrough"><Strikethrough /></button><button disabled={disabled || !activeBlock} onMouseDown={action(onLink)} title="Link"><Link2 /></button><span />
    <select aria-label="Font" disabled={disabled || !activeBlock} value={activeBlock?.style?.font || "default"} onChange={(event) => onStyle({ font: event.target.value as BlockStyle["font"] })}><option value="default">Default</option><option value="serif">Serif</option><option value="mono">Mono</option></select>
    <select aria-label="Text size" disabled={disabled || !activeBlock} value={activeBlock?.style?.size || "default"} onChange={(event) => onStyle({ size: event.target.value as BlockStyle["size"] })}><option value="small">Small</option><option value="default">Default</option><option value="large">Large</option></select>
    <button disabled={disabled || !activeBlock} onMouseDown={action(() => onStyle({ align: "left" }))} className={activeBlock?.style?.align === "left" || !activeBlock?.style?.align ? "is-selected" : ""}><AlignLeft /></button><button disabled={disabled || !activeBlock} onMouseDown={action(() => onStyle({ align: "center" }))} className={activeBlock?.style?.align === "center" ? "is-selected" : ""}><AlignCenter /></button><button disabled={disabled || !activeBlock} onMouseDown={action(() => onStyle({ align: "right" }))} className={activeBlock?.style?.align === "right" ? "is-selected" : ""}><AlignRight /></button>
    <div className="format-popover-wrap"><button disabled={disabled || !activeBlock} onMouseDown={action(() => setFormatOpen(formatOpen === "color" ? null : "color"))}><Palette /></button>{formatOpen === "color" ? <ColorPopover colors={textColors} value={activeBlock?.style?.color} onChoose={(color) => { onStyle({ color }); setFormatOpen(null); }} /> : null}</div>
    <div className="format-popover-wrap"><button disabled={disabled || !activeBlock} onMouseDown={action(() => setFormatOpen(formatOpen === "background" ? null : "background"))}><Highlighter /></button>{formatOpen === "background" ? <ColorPopover colors={backgrounds} value={activeBlock?.style?.background} onChoose={(background) => { onStyle({ background }); setFormatOpen(null); }} /> : null}</div>
  </div>;
}

function ColorPopover({ colors, value, onChoose }: { colors: string[]; value?: string; onChoose: (value: string) => void }) {
  return <div className="format-color-popover">{colors.map((color) => <button key={color} className={value === color ? "is-selected" : ""} style={{ background: color === "transparent" ? "linear-gradient(135deg,#fff 45%,#d35b45 46%,#d35b45 54%,#fff 55%)" : color }} onMouseDown={(event) => { event.preventDefault(); onChoose(color); }} aria-label={color === "transparent" ? "No color" : color} />)}</div>;
}

function PageSettings({ page, onChange, onDuplicate, onArchive }: { page: WorkspacePageRecord; onChange: (patch: Partial<WorkspacePageRecord>) => void; onDuplicate: () => void; onArchive: () => void }) {
  return <div className="page-settings-menu"><strong>Page style</strong><div className="page-font-picker">{(["default", "serif", "mono"] as const).map((font) => <button key={font} className={page.font === font ? "is-active" : ""} onClick={() => onChange({ font })}><span className={`font-preview font-preview--${font}`}>Ag</span>{font}</button>)}</div><label>Text size<select value={page.fontSize || "default"} onChange={(event) => onChange({ fontSize: event.target.value as WorkspacePageRecord["fontSize"] })}><option value="small">Small</option><option value="default">Default</option><option value="large">Large</option></select></label><button onClick={() => onChange({ fullWidth: !page.fullWidth })}><Maximize2 /><span><b>Full width</b><small>Use more of the canvas</small></span><i className={page.fullWidth ? "is-on" : ""} /></button><button onClick={() => onChange({ locked: !page.locked })}>{page.locked ? <Unlock /> : <Lock />}<span><b>{page.locked ? "Unlock page" : "Lock page"}</b><small>Prevent accidental edits</small></span></button><hr /><button onClick={onDuplicate}><Copy /><span><b>Duplicate</b><small>Copy page and blocks</small></span></button><button className="is-danger" onClick={onArchive}><Trash2 /><span><b>Move to trash</b><small>Archive page and children</small></span></button></div>;
}

function BlockRow({ block, number, locked, active, onActivate, onChange, onRemove, onDuplicate, onMove, onAdd, onCreateText, onTransform, onDragStart, onDrop }: {
  block: WorkspaceBlock; number: number; locked: boolean; active: boolean; onActivate: () => void; onChange: (patch: Partial<WorkspaceBlock>, record?: boolean) => void; onRemove: () => void; onDuplicate: () => void; onMove: (direction: -1 | 1) => void; onAdd: () => void; onCreateText: () => void; onTransform: (type: BlockType) => void; onDragStart: () => void; onDrop: () => void;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const style = { textAlign: block.style?.align || "left", color: block.style?.color || undefined, background: block.style?.background === "transparent" ? undefined : block.style?.background } as React.CSSProperties;
  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "/" && !block.content) { event.preventDefault(); onAdd(); return; }
    if (event.key === "Enter" && !event.shiftKey && block.type !== "code") { event.preventDefault(); onCreateText(); }
    if (event.key === "Backspace" && !block.content) { event.preventDefault(); onRemove(); }
  };
  return <div className={`block-row block-row--${block.type} block-font--${block.style?.font || "default"} block-size--${block.style?.size || "default"} ${active ? "is-active" : ""}`} style={style} data-block-id={block.id} draggable={!locked} onDragStart={onDragStart} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
    {!locked ? <div className="block-controls"><span className="block-grip" aria-hidden="true"><GripVertical /></span><button onClick={onAdd} aria-label="Add block below"><Plus /></button><button onClick={() => setActionsOpen((value) => !value)} aria-label="Block actions"><MoreHorizontal /></button>{actionsOpen ? <div className="block-actions-menu"><label>Turn into<select value={block.type} onChange={(event) => { onTransform(event.target.value as BlockType); setActionsOpen(false); }}>{blockTypes.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}</select></label><button onClick={() => onMove(-1)}>Move up</button><button onClick={() => onMove(1)}>Move down</button><button onClick={onDuplicate}><Copy />Duplicate</button><button className="is-danger" onClick={onRemove}><Trash2 />Delete</button></div> : null}</div> : <div />}
    {block.type === "divider" ? <hr /> : <div className="block-content">{block.type === "todo" ? <input type="checkbox" disabled={locked} aria-label="Complete block" checked={Boolean(block.checked)} onChange={(event) => onChange({ checked: event.target.checked })} /> : null}{block.type === "bullet" ? <span className="block-bullet" /> : null}{block.type === "numbered" ? <span className="block-number">{number}.</span> : null}{block.type === "toggle" ? <button className="block-toggle" disabled={locked} onClick={() => onChange({ collapsed: !block.collapsed })}>{block.collapsed ? <ChevronRight /> : <ChevronDown />}</button> : null}{block.type === "code" ? <div className="code-block"><select disabled={locked} value={block.language || "Plain text"} onChange={(event) => onChange({ language: event.target.value })}><option>Plain text</option><option>JavaScript</option><option>TypeScript</option><option>Python</option><option>SQL</option><option>JSON</option><option>Markdown</option></select><textarea readOnly={locked} value={block.content} onFocus={onActivate} onChange={(event) => onChange({ content: event.target.value }, false)} onKeyDown={onKeyDown} spellCheck={false} placeholder="Write code…" /></div> : <RichTextBlock block={block} locked={locked} onActivate={onActivate} onChange={onChange} onKeyDown={onKeyDown} />}</div>}
    {block.type === "toggle" && !block.collapsed ? <textarea className="toggle-detail" readOnly={locked} value={block.detail || ""} onChange={(event) => onChange({ detail: event.target.value }, false)} placeholder="Add toggle details…" /> : null}
  </div>;
}

function RichTextBlock({ block, locked, onActivate, onChange, onKeyDown }: { block: WorkspaceBlock; locked: boolean; onActivate: () => void; onChange: (patch: Partial<WorkspaceBlock>, record?: boolean) => void; onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || document.activeElement === ref.current) return;
    const next = block.html || escapeHtml(block.content);
    if (ref.current.innerHTML !== next) ref.current.innerHTML = next;
  }, [block.content, block.html]);
  return <div ref={ref} className={`block-input block-input--${block.type}`} data-rich-block contentEditable={!locked} suppressContentEditableWarning role="textbox" aria-multiline="true" data-placeholder={placeholderFor(block.type)} onFocus={onActivate} onInput={(event) => onChange({ content: event.currentTarget.innerText, html: sanitizeRichHtml(event.currentTarget.innerHTML) }, false)} onKeyDown={onKeyDown} />;
}

function BlockMenu({ onChoose, onClose }: { onChoose: (type: BlockType) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const items = blockTypes.filter((item) => `${item.label} ${item.copy}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="block-menu" role="dialog" aria-label="Add block menu"><header><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search blocks" /><button onClick={onClose} aria-label="Close block menu"><X /></button></header><strong>Basic blocks</strong>{items.map(({ type, label, copy, icon: Icon, shortcut }) => <button key={type} onClick={() => onChoose(type)}><span><Icon /></span><span><strong>{label}</strong><small>{copy}</small></span>{shortcut ? <kbd>{shortcut}</kbd> : null}</button>)}</div>;
}

function placeholderFor(type: BlockType) {
  if (type === "heading-1") return "Heading 1"; if (type === "heading-2") return "Heading 2"; if (type === "heading-3") return "Heading 3"; if (type === "todo") return "To-do"; if (type === "bullet" || type === "numbered") return "List item"; if (type === "toggle") return "Toggle"; if (type === "quote") return "Quote"; if (type === "callout") return "Callout"; return "Type '/' for commands";
}

function sanitizeRichHtml(value: string) {
  const template = document.createElement("template"); template.innerHTML = value;
  const allowed = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "A", "BR", "DIV", "SPAN"]);
  for (const element of [...template.content.querySelectorAll("*")]) {
    if (!allowed.has(element.tagName)) { element.replaceWith(...element.childNodes); continue; }
    for (const attribute of [...element.attributes]) if (!(element.tagName === "A" && attribute.name === "href")) element.removeAttribute(attribute.name);
    if (element.tagName === "A") { const href = element.getAttribute("href") || ""; if (!/^https?:\/\//i.test(href)) element.removeAttribute("href"); else { element.setAttribute("target", "_blank"); element.setAttribute("rel", "noreferrer"); } }
  }
  return template.innerHTML;
}

function escapeHtml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\n", "<br>"); }
