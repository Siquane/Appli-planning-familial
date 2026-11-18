import { filterNotes, noteHeading, notePreview, noteTint, sortNotes } from "../notes";
import { buildSnapshot } from "../../widgets/snapshot";
import type { Note } from "../../api/types";

const note = (over: Partial<Note>): Note => ({
  id: "n",
  title: "",
  body: "",
  shared: true,
  color: "default",
  pinned: false,
  mine: true,
  authorName: "Anaïs",
  createdAt: "2026-11-01T10:00:00Z",
  updatedAt: "2026-11-01T10:00:00Z",
  ...over,
});

describe("notes", () => {
  it("puts pinned notes first, then the latest", () => {
    const list = [note({ id: "old" }), note({ id: "new", updatedAt: "2026-11-05T10:00:00Z" }), note({ id: "pin", pinned: true })];
    expect(sortNotes(list).map((n) => n.id)).toEqual(["pin", "new", "old"]);
  });

  it("uses the title, else the first line, and previews the rest", () => {
    expect(noteHeading(note({ title: "Portail", body: "4521" }))).toBe("Portail");
    expect(noteHeading(note({ body: "Idées cadeaux\nLivre\nPuzzle" }))).toBe("Idées cadeaux");
    expect(notePreview(note({ body: "Idées cadeaux\nLivre\nPuzzle" }))).toBe("Livre · Puzzle");
    expect(notePreview(note({ title: "T", body: "a".repeat(200) }), 10)).toBe("aaaaaaaaa…");
    expect(noteHeading(note({ body: "  " }))).toBe("Note");
  });

  it("filters family and personal notes", () => {
    const list = [note({ id: "f" }), note({ id: "p", shared: false })];
    expect(filterNotes(list, "family").map((n) => n.id)).toEqual(["f"]);
    expect(filterNotes(list, "mine").map((n) => n.id)).toEqual(["p"]);
    expect(filterNotes(list, "all")).toHaveLength(2);
  });

  it("has a tint for every colour but the default", () => {
    expect(noteTint("default")).toBeNull();
    expect(noteTint("violet")).toMatch(/^#/);
    expect(noteTint("amber")).toMatch(/^#/);
  });

  it("keeps the 4 first notes for the widget", () => {
    const list = Array.from({ length: 6 }, (_, i) => note({ id: `n${i}`, body: `Note ${i}`, updatedAt: `2026-11-0${i + 1}T10:00:00Z` }));
    const s = buildSnapshot([], [], [], undefined, [], [], new Date(), list);
    expect(s.notes?.map((n) => n.id)).toEqual(["n5", "n4", "n3", "n2"]);
    expect(s.notes?.[0]).toMatchObject({ heading: "Note 5", preview: "", shared: true, pinned: false });
  });
});
