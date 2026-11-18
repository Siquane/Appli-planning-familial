import { queryClient } from "./queryClient";
import { PRIVATE_QUERY_KEYS, useChildSpaceStore } from "../state/childSpaceStore";

function forgetPrivateData() {
  queryClient.removeQueries({ predicate: (q) => PRIVATE_QUERY_KEYS.includes(String(q.queryKey[0])) });
}

/** Ouvre l'espace (budget et documents) d'un enfant. */
export function enterChildSpace(memberId: string, name: string) {
  if (useChildSpaceStore.getState().memberId === memberId) return;
  useChildSpaceStore.getState().set({ memberId, name });
  forgetPrivateData();
}

/** Revient à son propre budget et ses propres documents. */
export function exitChildSpace() {
  if (!useChildSpaceStore.getState().memberId) return;
  useChildSpaceStore.getState().set(null);
  forgetPrivateData();
}
