import { cheerLine, endTime, memberColor, memberProgress, nextTask, nowLineIndex, starsToWin, untilLabel } from "../planningView";
import { color } from "../../theme/tokens";

const t = (id: string, time: string, category = "Maison", memberIds: string[] = [], stars = 0) => ({ id, time, category: category as never, memberIds, stars });

describe("planningView", () => {
  it("donne aux membres les 4 couleurs du logo, dans l'ordre", () => {
    expect(memberColor(0)).toBe(color.pillar1);
    expect(memberColor(3)).toBe(color.pillar4);
    expect(memberColor(4)).toBe(color.pillar1);
  });

  it("calcule l'heure de fin", () => {
    expect(endTime("08:30", 450)).toBe("16:00");
    expect(endTime("23:30", 120)).toBe("23:59");
  });

  it("dit dans combien de temps", () => {
    expect(untilLabel("17:30", "16:42")).toBe("dans 48 min");
    expect(untilLabel("18:00", "16:55")).toBe("dans 1 h 05");
    expect(untilLabel("18:00", "16:00")).toBe("dans 2 h");
    expect(untilLabel("16:00", "16:42")).toBe("maintenant");
  });

  it("trouve la prochaine tâche à cocher, sans École ni Travail", () => {
    const tasks = [t("a", "08:30", "École"), t("b", "09:00", "Maison"), t("c", "17:30", "Maison"), t("d", "19:00")];
    expect(nextTask(tasks, new Set(), "08:00")?.id).toBe("b");
    expect(nextTask(tasks, new Set(["c"]), "10:00")?.id).toBe("d");
    expect(nextTask(tasks, new Set(), "20:00")).toBeNull();
  });

  it("place le trait de l'heure", () => {
    const tasks = [t("a", "07:45"), t("b", "17:30")];
    expect(nowLineIndex(tasks, "16:42")).toBe(1);
    expect(nowLineIndex(tasks, "06:00")).toBe(0);
    expect(nowLineIndex(tasks, "22:00")).toBe(2);
  });

  it("compte l'avancement et les étoiles d'un membre", () => {
    const tasks = [t("a", "07:45", "Santé", ["j"], 1), t("b", "08:30", "École", ["j"]), t("c", "17:30", "École", ["j"]), t("d", "17:30", "Maison", ["j"], 2), t("e", "19:00", "Maison", ["l"], 2)];
    expect(memberProgress(tasks, "j", new Set(["a"]))).toEqual({ done: 1, total: 2 });
    expect(starsToWin(tasks.filter((x) => x.memberIds.includes("j")), new Set(["a"]))).toBe(2);
  });

  it("encourage sans jamais gronder", () => {
    expect(cheerLine("Jules", 1, 3)).toBe("Bravo Jules, plus que 2 tâches !");
    expect(cheerLine("Jules", 3, 3)).toBe("Tout est fait, bravo Jules !");
    expect(cheerLine("Léa", 0, 1)).toBe("Allez Léa, 1 tâche au programme");
    expect(cheerLine("Léa", 0, 0)).toBe("Journée libre pour Léa");
  });
});
