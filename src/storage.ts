import { invoke, isTauri } from "@tauri-apps/api/core";
import { Workspace, createDefaultWorkspace, parseWorkspace } from "./board";

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

/** Returns the saved workspace, or a starter one on first launch. Throws if saved data is unreadable. */
export async function loadWorkspace(): Promise<Workspace> {
  const raw = await readRaw();
  return raw === null ? createDefaultWorkspace() : parseWorkspace(raw);
}

// Saves are chained so they always land on disk in the order they were made.
let queue: Promise<void> = Promise.resolve();

export function saveWorkspace(workspace: Workspace): Promise<void> {
  const json = JSON.stringify(workspace, null, 2);
  const next = queue.then(() => writeRaw(json));
  queue = next.catch(() => {});
  return next;
}
