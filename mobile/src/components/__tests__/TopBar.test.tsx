import renderer, { act } from "react-test-renderer";
import { TopBar } from "../TopBar";

jest.mock("react-native-svg", () => {
  const { View } = jest.requireActual("react-native");
  return { __esModule: true, default: View, Path: View, Circle: View, Rect: View };
});

const button = (tree: renderer.ReactTestRenderer, label: string) =>
  tree.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === "function");

describe("TopBar", () => {
  it("shows the duplicate button only when asked, and calls it", () => {
    const onDuplicate = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<TopBar title="Tâche" onBack={() => {}} onDuplicate={onDuplicate} onEdit={() => {}} />);
    });
    act(() => button(tree, "Dupliquer")[0].props.onPress());
    expect(onDuplicate).toHaveBeenCalledTimes(1);

    act(() => {
      tree.update(<TopBar title="Tâche" onBack={() => {}} onEdit={() => {}} />);
    });
    expect(button(tree, "Dupliquer")).toHaveLength(0);
  });
});
