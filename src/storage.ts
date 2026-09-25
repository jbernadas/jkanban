import { invoke, isTauri } from "@tauri-apps/api/core";
import { Board, createDefaultBoard, parseBoard } from "./board";

const LOCAL_KEY = "jkanban.board";

/** True when running inside the Tauri shell; false in a plain browser (`npm run dev`). */
export const inTauri = isTauri();

async function readRaw(): Promise<string | null> {
  if (inTauri) return invoke<string | null>("load_board");
  return localStorage.getItem(LOCAL_KEY);
}

async function writeRaw(json: string): Promise<void> {
  if (inTauri) return invoke("save_board", { data: json });
  localStorage.setItem(LOCAL_KEY, json);
}

/** Returns the saved board, or a starter board on first launch. Throws if saved data is unreadable. */
export async function loadBoard(): Promise<Board> {
  const raw = await readRaw();
  return raw === null ? createDefaultBoard() : parseBoard(raw);
}

// Saves are chained so they always land on disk in the order they were made.
let queue: Promise<void> = Promise.resolve();

export function saveBoard(board: Board): Promise<void> {
  const json = JSON.stringify(board, null, 2);
  const next = queue.then(() => writeRaw(json));
  queue = next.catch(() => {});
  return next;
}
