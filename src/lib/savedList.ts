import { get, set } from "idb-keyval";
import { CONFIG } from "./config";

const KEY = CONFIG.storage.savedKey;

export async function listSavedIds(): Promise<string[]> {
  return (await get(KEY)) ?? [];
}

export async function isSaved(id: string): Promise<boolean> {
  const ids = await listSavedIds();
  return ids.includes(id);
}

export async function toggleSaved(id: string): Promise<boolean> {
  const ids = await listSavedIds();
  const idx = ids.indexOf(id);
  if (idx === -1) {
    ids.push(id);
    await set(KEY, ids);
    return true;
  }
  ids.splice(idx, 1);
  await set(KEY, ids);
  return false;
}
