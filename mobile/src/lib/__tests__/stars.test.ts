import { isChild, memberAge, starsLabel, weekKey } from "../stars";

describe("weekKey", () => {
  it("gives the Monday of the week in local time", () => {
    expect(weekKey(new Date(2026, 10, 15, 23, 30))).toBe("2026-11-09"); // dimanche soir
    expect(weekKey(new Date(2026, 10, 16, 0, 5))).toBe("2026-11-16"); // lundi
    expect(weekKey(new Date(2027, 0, 1))).toBe("2026-12-28");
  });
});

describe("isChild", () => {
  it("uses the age, else the birthday", () => {
    expect(isChild({ age: 14, birthday: null })).toBe(true);
    expect(isChild({ age: 15, birthday: null })).toBe(false);
    expect(memberAge({ age: null, birthday: "2012-12-01" }, new Date(2026, 10, 15))).toBe(13);
    expect(isChild({ age: null, birthday: null })).toBe(false);
  });
});

it("starsLabel", () => {
  expect(starsLabel(1)).toBe("1 étoile");
  expect(starsLabel(3)).toBe("3 étoiles");
});
