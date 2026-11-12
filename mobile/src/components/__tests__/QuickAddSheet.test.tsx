import renderer, { act } from "react-test-renderer";
import { router } from "expo-router";
import { QuickAddSheet } from "../QuickAddSheet";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ bottom: 0, top: 0, left: 0, right: 0 }) }));
jest.mock("react-native-svg", () => {
  const { View } = jest.requireActual("react-native");
  return { __esModule: true, default: View, Path: View, Circle: View, Rect: View };
});

const byLabel = (tree: renderer.ReactTestRenderer, label: string) =>
  tree.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === "function")[0];

describe("QuickAddSheet", () => {
  it("closes and opens the chosen form", () => {
    const onClose = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<QuickAddSheet visible onClose={onClose} />);
    });
    act(() => byLabel(tree, "Ajouter : Dépense").props.onPress());
    expect(onClose).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/expense/new");

    act(() => byLabel(tree, "Ajouter : Tâche").props.onPress());
    expect(router.push).toHaveBeenLastCalledWith("/task/new");
  });
});
