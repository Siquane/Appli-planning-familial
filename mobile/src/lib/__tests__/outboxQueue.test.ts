import { createdId, enqueueInto, isTempId, newTempId, remapTempId, type OutboxItem } from "../outboxQueue";

const item = (over: Partial<OutboxItem>): OutboxItem => ({ id: Math.random().toString(), method: "POST", path: "/tasks", entity: "tasks", at: 0, ...over });

describe("waiting line of offline changes", () => {
  it("makes temporary ids that are recognisable", () => {
    const id = newTempId();
    expect(isTempId(id)).toBe(true);
    expect(isTempId("cmabc123")).toBe(false);
    expect(newTempId()).not.toBe(id);
  });

  it("keeps changes in the order they were made", () => {
    const a = item({ path: "/tasks/a", method: "PATCH", body: { title: "1" } });
    const b = item({ path: "/shopping/b", method: "DELETE", entity: "shopping" });
    expect(enqueueInto(enqueueInto([], a), b)).toEqual([a, b]);
  });

  it("drops a thing created and deleted while offline: nothing is ever sent", () => {
    const temp = newTempId();
    const create = item({ tempId: temp, body: { title: "x" } });
    const edit = item({ method: "PATCH", path: `/tasks/${temp}`, body: { notes: "n" } });
    const queue = enqueueInto(enqueueInto([create], edit), item({ method: "DELETE", path: `/tasks/${temp}` }));
    expect(queue).toEqual([]);
  });

  it("merges a later edit into the creation when the server takes those fields", () => {
    const temp = newTempId();
    const create = item({ tempId: temp, foldable: true, body: { title: "x", time: "08:00" } });
    const queue = enqueueInto([create], item({ method: "PATCH", path: `/tasks/${temp}`, body: { time: "09:00" } }));
    expect(queue).toHaveLength(1);
    expect(queue[0].body).toEqual({ title: "x", time: "09:00" });
  });

  it("keeps the edit separate when the creation can't carry it", () => {
    const temp = newTempId();
    const create = item({ tempId: temp, entity: "shopping", path: "/shopping", body: { label: "lait" } });
    const edit = item({ method: "PATCH", path: `/shopping/${temp}`, entity: "shopping", body: { checked: true } });
    expect(enqueueInto([create], edit)).toEqual([create, edit]);
  });

  it("points later changes at the real id once the server has created the thing", () => {
    const temp = newTempId();
    const later = item({ method: "PATCH", path: `/shopping/${temp}`, body: { checked: true } });
    const other = item({ method: "PATCH", path: "/shopping/real-1", body: { checked: false } });
    const [a, b] = remapTempId([later, other], temp, "real-9");
    expect(a.path).toBe("/shopping/real-9");
    expect(b).toEqual(other);
  });

  it("finds the id of what the server created, whatever wraps it", () => {
    expect(createdId({ task: { id: "t1", title: "x" } })).toBe("t1");
    expect(createdId({ item: { id: "i1" } })).toBe("i1");
    expect(createdId({ expense: { id: "e1" }, alert: null })).toBe("e1");
    expect(createdId(undefined)).toBeNull();
    expect(createdId({ ok: true })).toBeNull();
  });
});
