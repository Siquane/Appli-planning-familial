import { Switch } from "react-native";
import renderer, { act } from "react-test-renderer";
import { ReminderToggle } from "../ReminderToggle";

jest.mock("react-native-svg", () => {
  const { View } = jest.requireActual("react-native");
  return { __esModule: true, default: View, Path: View, Circle: View, Rect: View };
});

// The tappable row: the element labelled "Rappel" that handles presses.
function row(tree: renderer.ReactTestRenderer) {
  return tree.root.findAll((n) => n.props.accessibilityLabel === "Rappel" && typeof n.props.onPress === "function")[0];
}

function textOf(tree: renderer.ReactTestRenderer) {
  return JSON.stringify(tree.toJSON());
}

describe("ReminderToggle", () => {
  it("shows the off state and turns on from the switch or by tapping the row", () => {
    const onChange = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<ReminderToggle value={false} onChange={onChange} />);
    });
    expect(textOf(tree)).toContain("Recevoir une notification avant la tâche");
    expect(tree.root.findByType(Switch).props.value).toBe(false);

    act(() => tree.root.findByType(Switch).props.onValueChange(true));
    expect(onChange).toHaveBeenLastCalledWith(true);

    act(() => row(tree).props.onPress());
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it("shows the on state and turns off when the row is tapped", () => {
    const onChange = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<ReminderToggle value onChange={onChange} />);
    });
    expect(textOf(tree)).toContain("Activé : une notification avant la tâche");
    expect(tree.root.findByType(Switch).props.value).toBe(true);
    act(() => row(tree).props.onPress());
    expect(onChange).toHaveBeenLastCalledWith(false);
  });
});
