import { rememberWidgetRoute, routeForWidgetUrl, takeWidgetRoute, widgetUri } from "../links";

describe("widget links", () => {
  it("send each widget to its screen", () => {
    expect(routeForWidgetUrl(widgetUri("planning"), 1)).toBe("/home");
    expect(routeForWidgetUrl(widgetUri("menu"), 1)).toBe("/repas?tab=menu&w=1");
    expect(routeForWidgetUrl(widgetUri("courses"), 1)).toBe("/repas?tab=courses&w=1");
    expect(routeForWidgetUrl("/widget/courses", 2)).toBe("/repas?tab=courses&w=2");
    // The « Ajouter une tâche » button opens the new-task form.
    expect(routeForWidgetUrl(widgetUri("add-task"), 1)).toBe("/task/new");
  });

  it("leave other links alone", () => {
    expect(routeForWidgetUrl("passerelle://recipe/12")).toBeNull();
  });

  it("replay the route once, only shortly after the tap", () => {
    rememberWidgetRoute("/repas?tab=menu", 1000);
    expect(takeWidgetRoute(2000)).toBe("/repas?tab=menu");
    expect(takeWidgetRoute(2000)).toBeNull();
    rememberWidgetRoute("/repas?tab=menu", 1000);
    expect(takeWidgetRoute(60_000)).toBeNull();
  });
});
