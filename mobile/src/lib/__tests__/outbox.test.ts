jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  const api = {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
  };
  return { __esModule: true, default: api, ...api };
});

import type { ShoppingItem, Task } from "../../api/types";
import { useAuthStore } from "../../state/authStore";
import { useNetworkStore } from "../../state/networkStore";
import { useOutboxStore } from "../../state/outboxStore";
import { offlineShopping, offlineTasks } from "../offlineApi";
import { flushOutbox } from "../outbox";
import { clearQueryCache, queryClient } from "../queryClient";

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
const refused = (status: number) => ({ ok: false, status, json: async () => ({ error: "non" }) }) as Response;
const offline = () => Promise.reject(new TypeError("Network request failed"));

const input = { title: "Pharmacie", category: "Santé", weekday: 3, time: "10:00" } as const;

describe("working without a connection", () => {
  beforeEach(async () => {
    useAuthStore.setState({ accessToken: "a", refreshToken: "r" });
    useNetworkStore.setState({ online: true });
    await useOutboxStore.getState().clear();
    queryClient.clear();
    queryClient.setQueryData<Task[]>(["tasks"], []);
    queryClient.setQueryData<ShoppingItem[]>(["shopping"], []);
    global.fetch = jest.fn(offline) as unknown as typeof fetch;
  });

  it("sends straight away when the server answers", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(ok({ task: { id: "t1", title: "Pharmacie" } }));
    const res = await offlineTasks.create(input);
    expect(res.task.id).toBe("t1");
    expect(useOutboxStore.getState().items).toHaveLength(0);
  });

  it("shows a task at once when offline, keeps it, and sends it when the network is back", async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(offline);
    const res = await offlineTasks.create(input);
    expect(res.task.id).toMatch(/^tmp_/);
    expect(useNetworkStore.getState().online).toBe(false);
    expect(queryClient.getQueryData<Task[]>(["tasks"])).toHaveLength(1);
    expect(useOutboxStore.getState().items).toHaveLength(1);

    (global.fetch as jest.Mock).mockResolvedValueOnce(ok({ task: { id: "t9" } })).mockResolvedValue(ok({ tasks: [{ id: "t9", title: "Pharmacie" }] }));
    await flushOutbox();
    expect(useOutboxStore.getState().items).toHaveLength(0);
    const sent = (global.fetch as jest.Mock).mock.calls[0];
    expect(sent[0]).toContain("/tasks");
    expect(sent[1].method).toBe("POST");
    expect(JSON.parse(sent[1].body)).toMatchObject({ title: "Pharmacie" });
  });

  it("keeps the line and its order while still offline", async () => {
    await offlineShopping.add("lait");
    await offlineShopping.add("pain");
    await flushOutbox();
    expect(useOutboxStore.getState().items.map((i) => i.body)).toEqual([{ label: "lait" }, { label: "pain" }]);
  });

  it("ticks an item added offline with its real id once the server has created it", async () => {
    const { item } = await offlineShopping.add("lait");
    // The first change hasn't gone yet: the tick must wait its turn behind it.
    await offlineShopping.setChecked(item.id, true);
    await flushOutbox();
    expect(queryClient.getQueryData<ShoppingItem[]>(["shopping"])?.[0].checked).toBe(true);
    expect(useOutboxStore.getState().items).toHaveLength(2);

    (global.fetch as jest.Mock).mockReset();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(ok({ item: { id: "real-1" } }))
      .mockResolvedValueOnce(ok({ item: { id: "real-1", checked: true } }))
      .mockResolvedValue(ok({ items: [] }));
    await flushOutbox();

    const calls = (global.fetch as jest.Mock).mock.calls;
    expect([calls[0][0], calls[0][1].method]).toEqual(["http://localhost:4000/shopping", "POST"]);
    expect([calls[1][0], calls[1][1].method]).toEqual(["http://localhost:4000/shopping/real-1", "PATCH"]);
    expect(useOutboxStore.getState().items).toHaveLength(0);
  });

  it("drops a change the server turns down (already deleted elsewhere) and carries on", async () => {
    await offlineTasks.remove("gone");
    await offlineTasks.update("t2", { title: "Autre" });
    await flushOutbox();
    expect(useOutboxStore.getState().items).toHaveLength(2);
    (global.fetch as jest.Mock).mockReset();
    (global.fetch as jest.Mock).mockResolvedValueOnce(refused(404)).mockResolvedValueOnce(ok({ task: { id: "t2" } })).mockResolvedValue(ok({ tasks: [] }));
    await flushOutbox();
    expect(useOutboxStore.getState().items).toHaveLength(0);
  });

  it("is forgotten when the account signs out", async () => {
    await offlineTasks.create(input);
    expect(useOutboxStore.getState().items).toHaveLength(1);
    await clearQueryCache();
    expect(useOutboxStore.getState().items).toHaveLength(0);
  });
});
