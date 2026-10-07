import "fake-indexeddb/auto";
import { beforeEach, describe, it, expect } from "vitest";
import {
  closeDatabase,
  loadWorkspace,
  saveWorkspace,
  recoveryWorkspace,
} from "../src/storage";
import { emptyState, clone } from "../src/domain/model";
beforeEach(async () => {
  closeDatabase();
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.deleteDatabase("aps-truck-workspace-v2");
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
});
describe("atomic device storage", () => {
  it("initializes empty and reloads saved records", async () => {
    const s = await loadWorkspace();
    expect(s.revision).toBe(0);
    s.profile.name = "TEST";
    const saved = await saveWorkspace(s, 0);
    expect(saved.revision).toBe(1);
    expect((await loadWorkspace()).profile.name).toBe("TEST");
  });
  it("rejects stale concurrent writes without losing the winner", async () => {
    const s = await saveWorkspace(emptyState(), 0),
      a = clone(s),
      b = clone(s);
    a.profile.name = "Tab A";
    b.profile.name = "Tab B";
    await saveWorkspace(a, 1);
    await expect(saveWorkspace(b, 1)).rejects.toThrow("Another tab");
    expect((await loadWorkspace()).profile.name).toBe("Tab A");
  });
  it("keeps a pre-import recovery checkpoint in the same transaction", async () => {
    const s = emptyState();
    s.profile.name = "Before";
    const first = await saveWorkspace(s, 0),
      next = clone(first);
    next.profile.name = "After";
    await saveWorkspace(next, 1, true);
    expect((await recoveryWorkspace())?.profile.name).toBe("Before");
    expect((await loadWorkspace()).profile.name).toBe("After");
  });
});
