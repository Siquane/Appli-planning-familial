import { normalize, searchAll } from "../search";

const sources = {
  tasks: [
    { id: "t1", title: "Piscine Léa", notes: "", category: "Loisirs", weekday: 2, time: "17:00" },
    { id: "t2", title: "Courses", notes: "penser à la crème", category: "Maison", weekday: 0, time: "10:00" },
  ],
  recipes: [{ id: "r1", title: "Gratin", notes: "", ingredients: ["2 courgettes", "Crème fraîche"] }],
  documents: [{ id: "d1", title: "Ordonnance pédiatre", fileName: "scan.pdf" }],
  expenses: [{ id: "e1", label: "Piscine (abonnement)" }],
  shopping: [{ id: "s1", label: "crème" }],
} as never;

describe("searchAll", () => {
  it("ignores accents and case", () => {
    expect(normalize("  Crème Brûlée ")).toBe("creme brulee");
  });

  it("finds a word everywhere it appears", () => {
    const r = searchAll("creme", sources);
    expect(r.tasks.map((t) => t.id)).toEqual(["t2"]); // in the notes
    expect(r.recipes.map((x) => x.id)).toEqual(["r1"]); // in the ingredients
    expect(r.shopping).toHaveLength(1);
    expect(r.total).toBe(3);
  });

  it("matches tasks, expenses and documents by their names", () => {
    expect(searchAll("piscine", sources)).toMatchObject({ total: 2 });
    expect(searchAll("PEDIATRE", sources).documents).toHaveLength(1);
  });

  it("returns nothing for an empty query", () => {
    expect(searchAll("   ", sources).total).toBe(0);
  });
});
