import { create } from "zustand";

// « Espace de Jules » : un parent consulte et gère le budget et les documents
// d'un enfant qui a son accès. Tant qu'il est ouvert, les requêtes portent
// l'en-tête X-Child-Space (src/api/client.ts). Jamais gardé sur le téléphone :
// à la réouverture, on revient à son propre espace.
interface ChildSpaceState {
  memberId: string | null;
  name: string | null;
  set: (space: { memberId: string; name: string } | null) => void;
}

export const useChildSpaceStore = create<ChildSpaceState>((set) => ({
  memberId: null,
  name: null,
  set: (space) => set({ memberId: space?.memberId ?? null, name: space?.name ?? null }),
}));

/** Données propres à un espace (budget et documents) : à oublier quand on change d'espace. */
export const PRIVATE_QUERY_KEYS = ["documents", "expenses", "expense-categories", "category-budgets", "recurring-expenses", "savings-goals"];
