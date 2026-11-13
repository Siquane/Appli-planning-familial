import { rememberWidgetRoute, routeForWidgetUrl } from "../src/widgets/links";

// Incoming links (home-screen widgets): passerelle://widget/menu → Repas › Menu…
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const route = routeForWidgetUrl(path);
    if (!route) return path;
    rememberWidgetRoute(route);
    return route;
  } catch {
    return path;
  }
}
