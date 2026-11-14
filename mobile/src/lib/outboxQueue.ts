// The waiting line of changes made without a connection. Pure functions on a
// plain array, so the rules are easy to test; src/lib/outbox.ts stores the
// line on the phone and sends it when the network is back.

export type OutboxEntity = "tasks" | "shopping" | "meals" | "expenses";

export interface OutboxItem {
  id: string;
  method: "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  entity: OutboxEntity;
  /** Set on a creation: the temporary id shown on screen until the server gives the real one. */
  tempId?: string;
  /** A later change to this creation may be merged into its body (when the server takes those fields on creation). */
  foldable?: boolean;
  at: number;
}

const TEMP_RE = /tmp_[a-z0-9]+/;

export const newTempId = () => `tmp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
export const isTempId = (id: string) => TEMP_RE.test(id);
const tempIdIn = (path: string) => path.match(TEMP_RE)?.[0] ?? null;
const mentions = (item: OutboxItem, temp: string) => item.path.includes(temp) || JSON.stringify(item.body ?? null).includes(temp);

/** Adds a change to the line, folding it into earlier ones when that gives the same result with less to send. */
export function enqueueInto(queue: OutboxItem[], item: OutboxItem): OutboxItem[] {
  const temp = tempIdIn(item.path);
  if (temp) {
    // Deleting something that only ever existed on this phone: neither is sent.
    if (item.method === "DELETE") return queue.filter((q) => q.tempId !== temp && !mentions(q, temp));
    if (item.method === "PATCH") {
      const create = queue.find((q) => q.tempId === temp && q.method === "POST" && q.foldable);
      const before = create?.body;
      const change = item.body;
      if (create && isRecord(before) && isRecord(change)) {
        return queue.map((q) => (q === create ? { ...q, body: { ...before, ...change } } : q));
      }
    }
  }
  return [...queue, item];
}

/** The server gave `real` for `temp`: later changes that mention it now point at the real one. */
export function remapTempId(queue: OutboxItem[], temp: string, real: string): OutboxItem[] {
  return queue.map((q) =>
    mentions(q, temp) ? { ...q, path: q.path.split(temp).join(real), body: q.body === undefined ? undefined : JSON.parse(JSON.stringify(q.body).split(temp).join(real)) } : q,
  );
}

/** The id of the thing the server just created, whatever the answer is wrapped in (`{ task }`, `{ item }`…). */
export function createdId(response: unknown): string | null {
  if (!isRecord(response)) return null;
  for (const value of Object.values(response)) {
    if (isRecord(value) && typeof value.id === "string") return value.id;
  }
  return null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
