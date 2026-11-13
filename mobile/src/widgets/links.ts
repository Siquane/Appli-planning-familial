// Where a tap on each home-screen widget leads. The widget opens
// passerelle://widget/<target>; app/+native-intent.tsx turns that into a
// route. On a cold start the root redirect (login check → Planning) can win
// over the link, so the route is also kept here for a few seconds and
// replayed once the tabs are on screen.

export type WidgetTarget = "planning" | "menu" | "courses";

export function widgetUri(target: WidgetTarget): string {
  return `passerelle://widget/${target}`;
}

/** The route for an incoming URL, or null when it isn't a widget link. */
export function routeForWidgetUrl(url: string, now: number = Date.now()): string | null {
  const m = /widget\/(planning|menu|courses)\b/.exec(url);
  if (!m) return null;
  // `w` changes on every tap, so tapping the same widget twice still switches view.
  switch (m[1] as WidgetTarget) {
    case "menu":
      return `/repas?tab=menu&w=${now}`;
    case "courses":
      return `/repas?tab=courses&w=${now}`;
    default:
      return "/home";
  }
}

let pending: { route: string; at: number } | null = null;
const PENDING_MS = 15_000;

export function rememberWidgetRoute(route: string, now: number = Date.now()) {
  pending = { route, at: now };
}

/** The route a widget asked for in the last few seconds (once). */
export function takeWidgetRoute(now: number = Date.now()): string | null {
  const p = pending;
  pending = null;
  return p && now - p.at < PENDING_MS ? p.route : null;
}
