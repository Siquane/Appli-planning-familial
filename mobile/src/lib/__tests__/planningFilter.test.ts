import { filterByCategories, filterByMembers, isCheckable, toggleMember } from "../planningFilter";

const t = (id: string, memberIds: string[]) => ({ id, memberIds });
const tasks = [t("jules", ["j"]), t("lea", ["l"]), t("both", ["j", "l"]), t("family", [])];

describe("filterByMembers", () => {
  it("keeps everything without a choice", () => {
    expect(filterByMembers(tasks, [], ["j", "l"]).map((x) => x.id)).toEqual(["jules", "lea", "both", "family"]);
  });
  it("keeps the chosen members' tasks and the family's", () => {
    expect(filterByMembers(tasks, ["j"], ["j", "l"]).map((x) => x.id)).toEqual(["jules", "both", "family"]);
  });
  it("ignores a member who no longer exists", () => {
    expect(filterByMembers(tasks, ["gone"], ["j", "l"]).map((x) => x.id)).toEqual(["jules", "lea", "both", "family"]);
  });
});

describe("toggleMember", () => {
  it("adds, removes, and goes back to everyone when all are chosen", () => {
    expect(toggleMember([], "j", ["j", "l", "e"])).toEqual(["j"]);
    expect(toggleMember(["j"], "j", ["j", "l", "e"])).toEqual([]);
    expect(toggleMember(["j", "l"], "e", ["j", "l", "e"])).toEqual([]);
  });
});

describe("filterByCategories", () => {
  const cats = [{ id: "a", category: "École" as const }, { id: "b", category: "Santé" as const }, { id: "c", category: "Maison" as const }];
  it("keeps everything without a choice or with an unknown one", () => {
    expect(filterByCategories(cats, []).length).toBe(3);
    expect(filterByCategories(cats, ["Inconnue"]).length).toBe(3);
  });
  it("keeps only the chosen categories", () => {
    expect(filterByCategories(cats, ["École", "Maison"]).map((x) => x.id)).toEqual(["a", "c"]);
  });
});

describe("isCheckable", () => {
  it("leaves School and Work out", () => {
    expect(isCheckable({ category: "École" })).toBe(false);
    expect(isCheckable({ category: "Travail" })).toBe(false);
    expect(isCheckable({ category: "Maison" })).toBe(true);
  });
});
