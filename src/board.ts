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

export interface Board {
  version: 1;
  columns: Column[];
}

export const uid = (): string => crypto.randomUUID();

export function createDefaultBoard(): Board {
  const card = (title: string, description = ""): Card => ({ id: uid(), title, description });
  return {
    version: 1,
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
  };
}

/** Validates data loaded from disk; throws if it isn't a board. */
export function parseBoard(json: string): Board {
  const data = JSON.parse(json);
  const isString = (v: unknown): v is string => typeof v === "string";
  const valid =
    data?.version === 1 &&
    Array.isArray(data.columns) &&
    data.columns.every(
      (col: any) =>
        isString(col?.id) &&
        isString(col.title) &&
        Array.isArray(col.cards) &&
        col.cards.every((c: any) => isString(c?.id) && isString(c.title) && isString(c.description)),
    );
  if (!valid) throw new Error("Saved board has an unexpected format");
  return data as Board;
}

export function findCard(board: Board, cardId: string): { column: Column; index: number } | null {
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
export function moveCard(board: Board, cardId: string, toColumnId: string, toIndex: number): void {
  const from = findCard(board, cardId);
  const target = board.columns.find((c) => c.id === toColumnId);
  if (!from || !target) return;
  const [card] = from.column.cards.splice(from.index, 1);
  target.cards.splice(Math.max(0, Math.min(toIndex, target.cards.length)), 0, card);
}

/** Same index convention as `moveCard`. */
export function moveColumn(board: Board, columnId: string, toIndex: number): void {
  const from = board.columns.findIndex((c) => c.id === columnId);
  if (from === -1) return;
  const [column] = board.columns.splice(from, 1);
  board.columns.splice(Math.max(0, Math.min(toIndex, board.columns.length)), 0, column);
}
