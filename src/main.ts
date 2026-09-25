import "./styles.css";
import {
  Card,
  Column,
  MAX_PROJECTS,
  Project,
  Workspace,
  createProject,
  createWorkspace,
  findCard,
  moveCard,
  moveColumn,
  uid,
} from "./board";
import { inTauri, loadWorkspace, saveWorkspace } from "./storage";

const app = document.querySelector<HTMLDivElement>("#app")!;

let workspace: Workspace;
/** The project whose tab is open. */
let board: Project;
let canSave = true;

// UI state that must survive a re-render.
let composer: { columnId: string; draft: string } | null = null;
/** Column waiting for a second click on its delete button. */
let confirmDeleteId: string | null = null;
let renamingProjectId: string | null = null;

type Drag = { kind: "card" | "column"; id: string };
let drag: Drag | null = null;

// ---------- DOM helper ----------

type Props = Record<string, unknown> & { class?: string; dataset?: Record<string, string> };

/** Tiny element builder. Text children are inserted as text nodes, never as HTML. */
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: (Node | string | null | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") el.className = value as string;
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value as EventListener);
    else if (key in el) (el as any)[key] = value;
    else el.setAttribute(key, String(value));
  }
  for (const child of children) if (child) el.append(child);
  return el;
}

// ---------- State changes ----------

const statusEl = h("span", { class: "status", role: "status" });

function setStatus(text: string, error = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", error);
}

function commit() {
  render();
  if (!canSave) return;
  setStatus("Saving…");
  saveWorkspace(workspace).then(
    () => setStatus(inTauri ? "Saved" : "Saved to browser storage (preview mode)"),
    (err) => setStatus(`Save failed: ${err}`, true),
  );
}

function focusSoon(selector: string, select = false) {
  const el = app.querySelector<HTMLElement>(selector);
  el?.focus();
  if (select && el instanceof HTMLInputElement) el.select();
}

function addColumn() {
  const column: Column = { id: uid(), title: "New column", cards: [] };
  board.columns.push(column);
  commit();
  focusSoon(`.column[data-column-id="${column.id}"] .column-title`, true);
  app.querySelector(".board")?.scrollTo({ left: Number.MAX_SAFE_INTEGER, behavior: "smooth" });
}

/**
 * Deleting something that holds cards takes a second click within 3 seconds.
 * Returns true when the delete should go ahead.
 */
function confirmDelete(id: string, hasCards: boolean): boolean {
  if (!hasCards || confirmDeleteId === id) {
    confirmDeleteId = null;
    return true;
  }
  confirmDeleteId = id;
  render();
  setTimeout(() => {
    if (confirmDeleteId === id) {
      confirmDeleteId = null;
      render();
    }
  }, 3000);
  return false;
}

function deleteColumn(column: Column) {
  if (!confirmDelete(column.id, column.cards.length > 0)) return;
  board.columns = board.columns.filter((c) => c.id !== column.id);
  commit();
}

const cardCount = (project: Project) => project.columns.reduce((n, c) => n + c.cards.length, 0);

function switchProject(project: Project) {
  workspace.activeProjectId = project.id;
  board = project;
  composer = null;
  commit();
  app.querySelector(".board")?.scrollTo({ left: 0 });
}

function addProject() {
  if (workspace.projects.length >= MAX_PROJECTS) return;
  const project = createProject("New project");
  workspace.projects.push(project);
  renamingProjectId = project.id;
  switchProject(project);
  focusSoon(".tab-rename", true);
}

async function deleteProject(project: Project) {
  if (workspace.projects.length === 1) return;
  const cards = cardCount(project);
  const ok = await confirmDialog.ask(
    `Delete project “${project.name}”?`,
    cards > 0
      ? `Its ${cards} card${cards === 1 ? "" : "s"} will be deleted too. This can't be undone.`
      : "This can't be undone.",
    "Delete project",
  );
  if (!ok || !workspace.projects.includes(project)) return;
  const index = workspace.projects.indexOf(project);
  workspace.projects.splice(index, 1);
  if (project === board) switchProject(workspace.projects[Math.max(0, index - 1)]);
  else commit();
}

function addCard(column: Column, title: string) {
  column.cards.push({ id: uid(), title, description: "" });
  commit();
}

/** Keyboard alternative to dragging: Alt + arrow keys. */
function nudgeCard(cardId: string, key: string) {
  const loc = findCard(board, cardId);
  if (!loc) return;
  const colIndex = board.columns.indexOf(loc.column);
  if (key === "ArrowUp" && loc.index > 0) moveCard(board, cardId, loc.column.id, loc.index - 1);
  else if (key === "ArrowDown") moveCard(board, cardId, loc.column.id, loc.index + 1);
  else if (key === "ArrowLeft" && colIndex > 0) moveCard(board, cardId, board.columns[colIndex - 1].id, loc.index);
  else if (key === "ArrowRight" && colIndex < board.columns.length - 1)
    moveCard(board, cardId, board.columns[colIndex + 1].id, loc.index);
  else return;
  commit();
  focusSoon(`.card[data-card-id="${cardId}"]`);
}

// ---------- Card editor dialog ----------

const editor = (() => {
  const title = h("input", { name: "title", required: true, maxLength: 200, autocomplete: "off" });
  const description = h("textarea", { name: "description", rows: 6 });
  let cardId = "";
  const dialog = h(
    "dialog",
    { class: "editor" },
    h(
      "form",
      { method: "dialog" },
      h("h2", {}, "Edit card"),
      h("label", {}, "Title", title),
      h("label", {}, "Description", description),
      h(
        "div",
        { class: "editor-actions" },
        h("button", { value: "delete", class: "danger", formNoValidate: true }, "Delete"),
        h("span", { class: "spacer" }),
        h("button", { value: "cancel", formNoValidate: true }, "Cancel"),
        h("button", { value: "save", class: "primary" }, "Save"),
      ),
    ),
  );
  dialog.addEventListener("close", () => {
    const loc = findCard(board, cardId);
    if (!loc) return;
    if (dialog.returnValue === "save") {
      const card = loc.column.cards[loc.index];
      card.title = title.value.trim() || card.title;
      card.description = description.value.trim();
      commit();
    } else if (dialog.returnValue === "delete") {
      loc.column.cards.splice(loc.index, 1);
      commit();
      return;
    }
    focusSoon(`.card[data-card-id="${cardId}"]`);
  });
  document.body.append(dialog);

  return {
    open(card: Card) {
      cardId = card.id;
      title.value = card.title;
      description.value = card.description;
      dialog.returnValue = "";
      dialog.showModal();
      title.select();
    },
  };
})();

// ---------- Confirm dialog ----------

const confirmDialog = (() => {
  const heading = h("h2", {});
  const message = h("p", { class: "confirm-message" });
  const confirmBtn = h("button", { value: "confirm", class: "danger solid" });
  let settle: ((ok: boolean) => void) | null = null;
  const answer = (ok: boolean) => {
    settle?.(ok);
    settle = null;
  };
  const dialog = h(
    "dialog",
    // Escape. A late close from the previous question must not cancel a newly opened one.
    { class: "editor confirm", onclose: () => dialog.open || answer(false) },
    h(
      "form",
      {
        method: "dialog",
        // Answer on submit rather than on close: submit fires at once, while close is queued.
        onsubmit: (e: SubmitEvent) => answer((e.submitter as HTMLButtonElement | null)?.value === "confirm"),
      },
      heading,
      message,
      h(
        "div",
        { class: "editor-actions" },
        h("span", { class: "spacer" }),
        // First in tab order, so it gets focus: Enter right away cancels.
        h("button", { value: "cancel", autofocus: true }, "Cancel"),
        confirmBtn,
      ),
    ),
  );
  document.body.append(dialog);

  return {
    /** Resolves true only if the user clicks the confirm button (Escape cancels). */
    ask(title: string, text: string, confirmLabel: string): Promise<boolean> {
      heading.textContent = title;
      message.textContent = text;
      confirmBtn.textContent = confirmLabel;
      dialog.showModal();
      return new Promise((resolve) => (settle = resolve));
    },
  };
})();

// ---------- Drag and drop ----------
//
// Native HTML5 drag and drop. `dragDropEnabled: false` in tauri.conf.json stops
// Tauri from intercepting these events for OS file drops.
//
// While dragging, the dragged element is hidden and a placeholder shows where it
// will land. Drop positions are counted among the *other* items, matching the
// index convention of moveCard/moveColumn.

const cardPlaceholder = h("div", { class: "card-placeholder" });
const columnPlaceholder = h("div", { class: "column-placeholder" });
let dropIndex = 0;

function startDrag(e: DragEvent, el: HTMLElement, d: Drag, placeholder: HTMLElement) {
  drag = d;
  e.dataTransfer!.effectAllowed = "move";
  e.dataTransfer!.setData("text/plain", d.id); // some engines won't start a drag without data
  placeholder.style.height = `${el.offsetHeight}px`;
  // Hide the element on the next frame, after the browser has captured the drag image.
  requestAnimationFrame(() => {
    el.classList.add("dragging");
    el.after(placeholder);
  });
}

function endDrag() {
  drag = null;
  cardPlaceholder.remove();
  columnPlaceholder.remove();
  app.classList.remove("is-dragging");
  render();
}

/** Index of the first item whose midpoint lies past the pointer, or items.length. */
function indexAt(items: HTMLElement[], pos: number, axis: "x" | "y"): number {
  const i = items.findIndex((el) => {
    const r = el.getBoundingClientRect();
    return axis === "y" ? pos < r.top + r.height / 2 : pos < r.left + r.width / 2;
  });
  return i === -1 ? items.length : i;
}

function wireCardDrag(cardEl: HTMLElement, card: Card) {
  cardEl.addEventListener("dragstart", (e) => {
    e.stopPropagation(); // don't let the column think it's being dragged
    startDrag(e, cardEl, { kind: "card", id: card.id }, cardPlaceholder);
    app.classList.add("is-dragging");
  });
  cardEl.addEventListener("dragend", endDrag);
}

function wireColumnDropTarget(columnEl: HTMLElement, listEl: HTMLElement, column: Column) {
  columnEl.addEventListener("dragover", (e) => {
    if (drag?.kind !== "card") return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
    const cards = [...listEl.querySelectorAll<HTMLElement>(".card:not(.dragging)")];
    dropIndex = indexAt(cards, e.clientY, "y");
    const before = cards[dropIndex];
    if (before) {
      if (before.previousElementSibling !== cardPlaceholder) before.before(cardPlaceholder);
    } else if (listEl.lastElementChild !== cardPlaceholder) {
      listEl.append(cardPlaceholder);
    }
  });
  columnEl.addEventListener("drop", (e) => {
    if (drag?.kind !== "card") return;
    e.preventDefault();
    moveCard(board, drag.id, column.id, dropIndex);
    drag = null;
    commit();
  });
}

function wireColumnDrag(columnEl: HTMLElement, headerEl: HTMLElement, column: Column) {
  // Only make the column draggable when the grab starts on the header (not its
  // title input or buttons), so text selection and card drags still work.
  headerEl.addEventListener("pointerdown", (e) => {
    const target = e.target as HTMLElement;
    columnEl.draggable = !target.closest("input, button");
  });
  headerEl.addEventListener("pointerup", () => (columnEl.draggable = false));
  columnEl.addEventListener("dragstart", (e) => {
    if (e.target !== columnEl) return;
    startDrag(e, columnEl, { kind: "column", id: column.id }, columnPlaceholder);
    app.classList.add("is-dragging");
  });
  columnEl.addEventListener("dragend", (e) => {
    if (e.target === columnEl) endDrag();
  });
}

function wireBoardDropTarget(boardEl: HTMLElement, addColumnBtn: HTMLElement) {
  boardEl.addEventListener("dragover", (e) => {
    if (drag?.kind !== "column") return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
    const cols = [...boardEl.querySelectorAll<HTMLElement>(".column:not(.dragging)")];
    dropIndex = indexAt(cols, e.clientX, "x");
    const before = cols[dropIndex] ?? addColumnBtn;
    if (before.previousElementSibling !== columnPlaceholder) before.before(columnPlaceholder);
  });
  boardEl.addEventListener("drop", (e) => {
    if (drag?.kind !== "column") return;
    e.preventDefault();
    moveColumn(board, drag.id, dropIndex);
    drag = null;
    commit();
  });
}

// ---------- Rendering ----------

function renderCard(card: Card): HTMLElement {
  const el = h(
    "article",
    {
      class: "card",
      draggable: true,
      tabIndex: 0,
      dataset: { cardId: card.id },
      title: "Click to edit · drag to move · Alt+arrows to move",
      onclick: () => editor.open(card),
      onkeydown: (e: KeyboardEvent) => {
        if (e.target !== el) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          editor.open(card);
        } else if (e.altKey && e.key.startsWith("Arrow")) {
          e.preventDefault();
          nudgeCard(card.id, e.key);
        }
      },
    },
    h("div", { class: "card-title" }, card.title),
    card.description && h("div", { class: "card-desc" }, card.description),
  );
  wireCardDrag(el, card);
  return el;
}

function renderComposer(column: Column): HTMLElement {
  if (composer?.columnId !== column.id) {
    return h(
      "button",
      {
        class: "add-card",
        onclick: () => {
          composer = { columnId: column.id, draft: "" };
          render();
          focusSoon(".composer textarea");
        },
      },
      "+ Add card",
    );
  }

  const close = () => {
    composer = null;
    render();
  };
  const submit = () => {
    const title = input.value.trim();
    if (!title) return;
    composer!.draft = "";
    addCard(column, title);
    focusSoon(".composer textarea");
  };
  const input = h("textarea", {
    rows: 2,
    placeholder: "Card title…",
    value: composer.draft,
    oninput: () => (composer!.draft = input.value),
    onkeydown: (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      } else if (e.key === "Escape") {
        close();
      }
    },
  });
  return h(
    "div",
    { class: "composer" },
    input,
    h(
      "div",
      { class: "composer-actions" },
      h("button", { class: "primary", onclick: submit }, "Add"),
      h("button", { onclick: close }, "Cancel"),
    ),
  );
}

function renderColumn(column: Column): HTMLElement {
  const titleInput = h("input", {
    class: "column-title",
    value: column.title,
    "aria-label": "Column title",
    maxLength: 80,
    onkeydown: (e: KeyboardEvent) => {
      if (e.key === "Enter") titleInput.blur();
      if (e.key === "Escape") {
        titleInput.value = column.title;
        titleInput.blur();
      }
    },
    onchange: () => {
      column.title = titleInput.value.trim() || "Untitled";
      commit();
    },
  });

  const confirming = confirmDeleteId === column.id;
  const header = h(
    "header",
    { class: "column-header", title: "Drag to reorder columns" },
    h("span", { class: "grip", "aria-hidden": "true" }, "⠿"),
    titleInput,
    h("span", { class: "count" }, String(column.cards.length)),
    h(
      "button",
      {
        class: confirming ? "delete-column confirm" : "delete-column",
        "aria-label": `Delete column ${column.title}`,
        title: "Delete column",
        onclick: () => deleteColumn(column),
      },
      confirming ? `Delete ${column.cards.length} card${column.cards.length === 1 ? "" : "s"}?` : "×",
    ),
  );

  const list = h("div", { class: "card-list" }, ...column.cards.map(renderCard));
  const el = h(
    "section",
    { class: "column", dataset: { columnId: column.id } },
    header,
    list,
    renderComposer(column),
  );
  wireColumnDrag(el, header, column);
  wireColumnDropTarget(el, list, column);
  return el;
}

function renderTab(project: Project): HTMLElement {
  const active = project === board;
  if (renamingProjectId === project.id) {
    const finish = (save: boolean, refocus = true) => {
      // Runs once: the re-render below removes the input, which can fire another blur.
      if (renamingProjectId !== project.id) return;
      renamingProjectId = null;
      if (save) project.name = input.value.trim() || project.name;
      commit();
      if (refocus) focusSoon(".tab.active .tab-name");
    };
    const input = h("input", {
      class: "tab tab-rename",
      value: project.name,
      "aria-label": "Project name",
      maxLength: 40,
      onkeydown: (e: KeyboardEvent) => {
        if (e.key === "Enter") finish(true);
        if (e.key === "Escape") finish(false);
      },
      onblur: () => finish(true, false), // keep focus wherever the user clicked
    });
    return input;
  }

  return h(
    "div",
    { class: active ? "tab active" : "tab" },
    h(
      "button",
      {
        class: "tab-name",
        "aria-current": active ? "page" : "false",
        title: active ? "Double-click to rename" : `Open ${project.name}`,
        onclick: () => active || switchProject(project),
        ondblclick: () => {
          renamingProjectId = project.id;
          render();
          focusSoon(".tab-rename", true);
        },
      },
      project.name,
    ),
    workspace.projects.length > 1 &&
      h(
        "button",
        {
          class: "delete-tab",
          "aria-label": `Delete project ${project.name}`,
          title: "Delete project",
          onclick: () => deleteProject(project),
        },
        "×",
      ),
  );
}

function renderTabs(): HTMLElement {
  const full = workspace.projects.length >= MAX_PROJECTS;
  return h(
    "nav",
    { class: "tabs", "aria-label": "Projects" },
    ...workspace.projects.map(renderTab),
    h(
      "button",
      {
        class: "add-tile add-tab",
        "aria-label": "Add project",
        title: full ? `You can have up to ${MAX_PROJECTS} projects` : "Add project",
        disabled: full,
        onclick: addProject,
      },
      "+",
    ),
  );
}

function render() {
  // Don't rebuild the DOM mid-drag: it would destroy the element being dragged.
  if (drag) return;
  const addColumnBtn = h(
    "button",
    { class: "add-tile add-column", "aria-label": "Add column", title: "Add column", onclick: addColumn },
    "+",
  );
  const boardEl = h("main", { class: "board" }, ...board.columns.map(renderColumn), addColumnBtn);
  wireBoardDropTarget(boardEl, addColumnBtn);

  const scroll = app.querySelector(".board")?.scrollLeft ?? 0;
  app.replaceChildren(h("header", { class: "topbar" }, h("h1", {}, "jKanban"), statusEl), renderTabs(), boardEl);
  boardEl.scrollLeft = scroll;
}

// ---------- Startup ----------

async function init() {
  try {
    workspace = await loadWorkspace();
    setStatus(inTauri ? "" : "Browser preview — saving to localStorage");
  } catch (err) {
    // Never overwrite a board we couldn't read.
    canSave = false;
    workspace = createWorkspace({ id: uid(), name: "My board", columns: [] });
    setStatus(`Couldn't load your board (${err}). Changes won't be saved.`, true);
  }
  board = workspace.projects.find((p) => p.id === workspace.activeProjectId)!;
  render();
}

init();
