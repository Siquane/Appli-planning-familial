import { useState } from "react";
import { Switch } from "react-native";
import renderer, { act } from "react-test-renderer";
import { ScheduleTimes } from "../ScheduleTimes";
import type { DayTimes } from "../../lib/dayTimes";
import type { Weekday } from "../../api/types";

jest.mock("@react-native-community/datetimepicker", () => "DateTimePicker");

let latest: { perDay: boolean; dayTimes: DayTimes } = { perDay: false, dayTimes: {} };

function Harness({ weekdays }: { weekdays: Weekday[] }) {
  const [time, setTime] = useState("08:00");
  const [perDay, setPerDay] = useState(false);
  const [dayTimes, setDayTimes] = useState<DayTimes>({});
  latest = { perDay, dayTimes };
  return (
    <ScheduleTimes
      weekdays={weekdays}
      time={time}
      onTimeChange={setTime}
      perDay={perDay}
      onPerDayChange={setPerDay}
      dayTimes={dayTimes}
      onDayTimesChange={setDayTimes}
    />
  );
}

const text = (tree: renderer.ReactTestRenderer) => JSON.stringify(tree.toJSON());

describe("ScheduleTimes", () => {
  it("shows a single time and no switch for one day", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Harness weekdays={[1]} />);
    });
    expect(tree.root.findAllByType(Switch)).toHaveLength(0);
    expect(text(tree)).toContain("Heure");
  });

  it("offers one time per day, prefilled with the shared time, when the switch is on", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Harness weekdays={[3, 1]} />);
    });
    act(() => tree.root.findByType(Switch).props.onValueChange(true));

    expect(latest.perDay).toBe(true);
    expect(latest.dayTimes).toEqual({ 1: "08:00", 3: "08:00" });
    const out = text(tree);
    expect(out.indexOf("Mardi")).toBeGreaterThan(-1);
    expect(out.indexOf("Mardi")).toBeLessThan(out.indexOf("Jeudi"));
  });
});
