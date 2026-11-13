import renderer, { act } from "react-test-renderer";
import type { BottomTabBarProps } from "expo-router/tabs";
import { CustomTabBar } from "../CustomTabBar";
import { color } from "../../theme/tokens";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ bottom: 0, top: 0, left: 0, right: 0 }) }));
jest.mock("react-native-svg", () => {
  const { View } = jest.requireActual("react-native");
  const Svg = (props: { color?: string; stroke?: string; children?: unknown }) => <View {...props} />;
  return { __esModule: true, default: Svg, Path: Svg, Circle: Svg, Rect: Svg, Line: Svg, Defs: Svg, LinearGradient: Svg, Stop: Svg };
});

const routes = ["home", "repas", "budget", "famille"].map((name) => ({ key: name, name }));

function render(index: number) {
  const navigateToTab = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    const props = { state: { routes, index }, navigateToTab } as unknown as BottomTabBarProps;
    tree = renderer.create(<CustomTabBar {...props} />);
  });
  return { tree, navigateToTab };
}

const tab = (tree: renderer.ReactTestRenderer, label: string) =>
  tree.root.findAll((n) => n.props.accessibilityRole === "tab" && n.props.accessibilityLabel === label && typeof n.props.onPress === "function")[0];

describe("CustomTabBar", () => {
  it("shows the 4 pillars around the + and navigates to them", () => {
    const { tree, navigateToTab } = render(0);
    for (const label of ["Planning", "Repas", "Budget", "Famille"]) expect(tab(tree, label)).toBeTruthy();
    act(() => tab(tree, "Budget").props.onPress());
    expect(navigateToTab).toHaveBeenCalledWith("budget");
  });

  it("colours the active tab with its ring colour from the logo", () => {
    const { tree } = render(3);
    const labelColor = (label: string) => JSON.stringify(tab(tree, label).findByProps({ children: label }).props.style);
    expect(labelColor("Famille")).toContain(color.pillar4);
    expect(labelColor("Planning")).toContain(color.neutral500);
    expect(labelColor("Planning")).not.toContain(color.pillar1);
  });
});
