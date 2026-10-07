import { emptyState, type Workspace } from "./domain/model";
const DB = "aps-truck-workspace-v2";
let connection: Promise<IDBDatabase> | null = null;
export function openDatabase() {
  return (connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("workspace");
      r.result.createObjectStore("recovery");
    };
    r.onsuccess = () => {
      r.result.onversionchange = () => {
        r.result.close();
        connection = null;
      };
      resolve(r.result);
    };
    r.onerror = () => {
      connection = null;
      reject(r.error);
    };
    r.onblocked = () =>
      reject(Error("Close the other Work Diary tab to update storage."));
  }));
}
export async function loadWorkspace(): Promise<Workspace> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const r = db
      .transaction("workspace")
      .objectStore("workspace")
      .get("current");
    r.onsuccess = () => {
      if (r.result && r.result.schema !== 2)
        reject(Error("This backup needs a newer app version."));
      else resolve(r.result || emptyState());
    };
    r.onerror = () => reject(r.error);
  });
}
export async function saveWorkspace(
  next: Workspace,
  expected: number,
  checkpoint = false,
) {
  const db = await openDatabase();
  return new Promise<Workspace>((resolve, reject) => {
    const tx = db.transaction(["workspace", "recovery"], "readwrite");
    let conflict = false;
    const store = tx.objectStore("workspace");
    const get = store.get("current");
    get.onsuccess = () => {
      const old = get.result as Workspace | undefined;
      if ((old?.revision || 0) !== expected) {
        conflict = true;
        tx.abort();
        return;
      }
      if (checkpoint && old) tx.objectStore("recovery").put(old, "previous");
      const saved = { ...next, revision: expected + 1 };
      store.put(saved, "current");
    };
    tx.oncomplete = () => {
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("truck-workspace");
        channel.postMessage(expected + 1);
        channel.close();
      }
      resolve({ ...next, revision: expected + 1 });
    };
    tx.onerror = () =>
      reject(
        tx.error ||
          Error("Storage failed. Your previous saved records are unchanged."),
      );
    tx.onabort = () =>
      reject(
        conflict
          ? Error(
              "Another tab saved changes. Reload before editing to avoid overwriting records.",
            )
          : tx.error || Error("Save did not complete."),
      );
  });
}
export async function recoveryWorkspace() {
  const db = await openDatabase();
  return new Promise<Workspace | undefined>((resolve, reject) => {
    const r = db
      .transaction("recovery")
      .objectStore("recovery")
      .get("previous");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export function closeDatabase() {
  connection?.then((d) => d.close());
  connection = null;
}
