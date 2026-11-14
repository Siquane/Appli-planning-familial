import { OFFLINE_MESSAGE, errorText, statusMessage } from "../errors";

describe("error messages", () => {
  it("say what to do for unexplained server errors", () => {
    expect(statusMessage(500)).toBe("Le serveur rencontre un souci. Réessaie dans un instant.");
    expect(statusMessage(404)).toContain("Actualise");
    expect(statusMessage(400)).toContain("réessaie");
  });

  it("keep a message meant for people, translate network failures, and fall back to the action", () => {
    expect(errorText(new Error("Titre trop long"), "enregistrer la tâche")).toBe("Titre trop long");
    expect(errorText(new TypeError("Network request failed"), "enregistrer la tâche")).toBe(OFFLINE_MESSAGE);
    expect(errorText("??", "enregistrer la tâche")).toBe("Impossible d'enregistrer la tâche. Réessaie.");
  });
});
