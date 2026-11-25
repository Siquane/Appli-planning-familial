import { fetesOf, SUCCESSES } from "./badges";
import { ADVENT_ITEMS } from "./advent";
import type { CatalogItem } from "./shop";
import { PATH_END, THEMES, themeOf } from "./stars";

// « Comment l'avoir ? » : for the items the shop does not sell (won with a
// badge, or at the end of a month's star path), one plain sentence that says
// exactly what to do. Shown in the shop when the child touches the item.

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function nextMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** `today`: « YYYY-MM-DD » (Paris). Null for an item that is simply bought. */
export function howToGet(item: CatalogItem, today: string): string | null {
  if (item.kind === "badge" && item.badge) {
    const [id, tier] = item.badge.key.split(":");
    if (id === "fete") {
      const year = Number(today.slice(0, 4));
      const fete = [...fetesOf(year), ...fetesOf(year + 1)].find((f) => f.key.startsWith(`fete:${tier}`));
      return `Gagne le badge « ${item.badge.label} » dans « Tes badges ». ${fete ? `Pour ça : ${lower(fete.hint)}` : ""}`.trim();
    }
    const success = SUCCESSES.find((s) => s.id === id);
    const t = Number(tier);
    if (success && t >= 1 && t <= 3) {
      return `Gagne le badge « ${item.badge.label} » : ${lower(success.describe(success.tiers[t - 1]))}`;
    }
    return `Gagne le badge « ${item.badge.label} » dans « Tes badges ».`;
  }
  if (item.kind === "chemin") {
    const month = today.slice(0, 7);
    for (let n = 0; n < THEMES.length; n++) {
      const m = nextMonth(month, n);
      const theme = themeOf(m);
      if (theme.item !== item.id) continue;
      return n === 0
        ? `C'est le cadeau du chemin d'étoiles de ce mois-ci (« ${theme.label} ») : gagne ${PATH_END} étoiles avant la fin du mois. Touche ⭐ sur l'accueil pour voir où tu en es.`
        : `C'est le cadeau du chemin d'étoiles de ${MONTHS[Number(m.slice(5, 7)) - 1]} (« ${theme.label} ») : ce mois-là, gagne ${PATH_END} étoiles.`;
    }
    return `C'est un cadeau du chemin d'étoiles : gagne ${PATH_END} étoiles dans le mois.`;
  }
  if (item.kind === "avent") {
    const box = ADVENT_ITEMS.find((a) => a.item === item.id);
    return `Il se cache derrière ${box ? `la case ${box.day}` : "une case"} du calendrier de l'Avent (en décembre). Révise pour ouvrir les cases : touche 🎄 sur l'accueil.`;
  }
  return null;
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
