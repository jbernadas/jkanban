export interface Card {
  id: string;
  title: string;
  description: string;
}

export interface Column {
  id: string;
  title: string;
  cards: Card[];
}

export interface Project {
  id: string;
  name: string;
  columns: Column[];
}

/** Everything saved to disk: all projects, plus which tab was open. */
export interface Workspace {
  version: 2;
  activeProjectId: string;
  projects: Project[];
}

export const MAX_PROJECTS = 8;

/** Sticky-note colour for each tab position, so projects are easy to tell
    apart. The first is always yellow. Styled in styles.css. */
export const NOTE_COLORS = ["yellow", "peach", "pink", "green", "blue", "orange", "lavender", "mint"] as const;

export const uid = (): string => crypto.randomUUID();

export function createProject(name: string): Project {
  const column = (title: string): Column => ({ id: uid(), title, cards: [] });
  return { id: uid(), name, columns: [column("To do"), column("In progress"), column("Done")] };
}

export function createWorkspace(project: Project): Workspace {
  return { version: 2, activeProjectId: project.id, projects: [project] };
}

export function createDefaultWorkspace(): Workspace {
  const card = (title: string, description = ""): Card => ({ id: uid(), title, description });
  return createWorkspace({
    id: uid(),
    name: "My board",
    columns: [
      {
        id: uid(),
        title: "To do",
        cards: [
          card("Drag me to another column", "Cards can be reordered within a column too."),
          card("Click a card to edit it"),
          card("Drag a column by its header to reorder columns"),
        ],
      },
      { id: uid(), title: "In progress", cards: [card("Try the keyboard", "Focus a card, then Alt + arrow keys moves it.")] },
      { id: uid(), title: "Done", cards: [] },
    ],
  });
}

/**
 * Validates data loaded from disk; throws if it isn't a workspace.
 * A version 1 file (a single board) becomes a workspace with one project.
 */
export function parseWorkspace(json: string): Workspace {
  const data = JSON.parse(json);
  const isString = (v: unknown): v is string => typeof v === "string";
  const validColumns = (columns: unknown) =>
    Array.isArray(columns) &&
    columns.every(
      (col: any) =>
        isString(col?.id) &&
        isString(col.title) &&
        Array.isArray(col.cards) &&
        col.cards.every((c: any) => isString(c?.id) && isString(c.title) && isString(c.description)),
    );

  if (data?.version === 1 && validColumns(data.columns)) {
    return createWorkspace({ id: uid(), name: "My board", columns: data.columns });
  }
  const valid =
    data?.version === 2 &&
    isString(data.activeProjectId) &&
    Array.isArray(data.projects) &&
    data.projects.length > 0 &&
    data.projects.every((p: any) => isString(p?.id) && isString(p.name) && validColumns(p.columns));
  if (!valid) throw new Error("Saved board has an unexpected format");
  const workspace = data as Workspace;
  if (!workspace.projects.some((p) => p.id === workspace.activeProjectId)) {
    workspace.activeProjectId = workspace.projects[0].id;
  }
  return workspace;
}

export function findCard(board: Project, cardId: string): { column: Column; index: number } | null {
  for (const column of board.columns) {
    const index = column.cards.findIndex((c) => c.id === cardId);
    if (index !== -1) return { column, index };
  }
  return null;
}

/**
 * Moves a card to `toIndex` in the target column. `toIndex` is counted with
 * the moved card already removed, which is how the drop position is measured.
 */
export function moveCard(board: Project, cardId: string, toColumnId: string, toIndex: number): void {
  const from = findCard(board, cardId);
  const target = board.columns.find((c) => c.id === toColumnId);
  if (!from || !target) return;
  const [card] = from.column.cards.splice(from.index, 1);
  target.cards.splice(Math.max(0, Math.min(toIndex, target.cards.length)), 0, card);
}

/** Same index convention as `moveCard`. */
export function moveColumn(board: Project, columnId: string, toIndex: number): void {
  const from = board.columns.findIndex((c) => c.id === columnId);
  if (from === -1) return;
  const [column] = board.columns.splice(from, 1);
  board.columns.splice(Math.max(0, Math.min(toIndex, board.columns.length)), 0, column);
}
