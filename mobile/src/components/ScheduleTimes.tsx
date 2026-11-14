import { Switch, View } from "react-native";
import { Pressable } from "./Touchable";
import { Text } from "./Text";
import { TimeField } from "./TimeField";
import { sortWeekdays, type DayTimes } from "../lib/dayTimes";
import { WEEKDAYS_FULL } from "../lib/weekdays";
import { color, space } from "../theme/tokens";
import type { Weekday } from "../api/types";

interface Props {
  weekdays: Weekday[];
  time: string;
  onTimeChange: (time: string) => void;
  perDay: boolean;
  onPerDayChange: (perDay: boolean) => void;
  dayTimes: DayTimes;
  onDayTimesChange: (dayTimes: DayTimes) => void;
}

// One shared "Heure" by default. With two days or more, a switch lets each
// day have its own time (ex. Mardi 11:30, Jeudi 17:00); each day starts from
// the shared time so nothing has to be re-entered.
export function ScheduleTimes({ weekdays, time, onTimeChange, perDay, onPerDayChange, dayTimes, onDayTimesChange }: Props) {
  const several = weekdays.length >= 2;
  const showPerDay = several && perDay;

  function togglePerDay(next: boolean) {
    if (next) {
      const filled: DayTimes = { ...dayTimes };
      for (const w of weekdays) filled[w] ??= time;
      onDayTimesChange(filled);
    }
    onPerDayChange(next);
  }

  return (
    <View style={{ gap: space[3] }}>
      {!showPerDay && <TimeField label="Heure" value={time} onChange={onTimeChange} />}

      {several && (
        <Pressable
          onPress={() => togglePerDay(!perDay)}
          accessibilityRole="switch"
          accessibilityState={{ checked: perDay }}
          accessibilityLabel="Heure différente selon le jour"
          style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}
        >
          <Text size={13} style={{ flex: 1 }}>
            Heure différente selon le jour
          </Text>
          <Switch
            value={perDay}
            onValueChange={togglePerDay}
            trackColor={{ false: color.neutral700, true: color.accent700 }}
            thumbColor={perDay ? color.accent300 : color.neutral300}
            ios_backgroundColor={color.neutral700}
          />
        </Pressable>
      )}

      {showPerDay && (
        <View style={{ gap: space[2] }}>
          {sortWeekdays(weekdays).map((w) => (
            <View key={w} style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
              <Text size={15} style={{ width: 90 }}>
                {WEEKDAYS_FULL[w]}
              </Text>
              <TimeField value={dayTimes[w] ?? time} onChange={(t) => onDayTimesChange({ ...dayTimes, [w]: t })} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
