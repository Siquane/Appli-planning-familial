// End-of-month forecast (Premium): « À ce rythme, tu finiras le mois à
// environ 2 340 € ».
//
// Recurring expenses (rent, subscriptions…) are known for the whole month, so
// they count in full. The rest ("variable" spending) is extrapolated from the
// pace so far. Early in the month that pace says little, so it is blended
// with the average variable spending of the previous months: the further into
// the month, the more the current pace weighs.

export interface ForecastInput {
  /** Day of the month today (1-31). */
  today: number;
  daysInMonth: number;
  /** Every recurring copy of the month, past or still to come. */
  recurringCents: number;
  /** Recurring copies dated after today. */
  upcomingRecurringCents: number;
  /** Other expenses dated today or before. */
  variableSoFarCents: number;
  /** Other expenses already entered with a later date this month (planned). */
  plannedVariableCents: number;
  /** Variable spending of the previous months that had any (most recent first), up to 3. */
  previousVariableCents: number[];
}

export interface Forecast {
  spentCents: number;
  upcomingRecurringCents: number;
  projectedCents: number;
  /** Average total of the previous months used, for comparison; null without history. */
  usualCents: number | null;
}

export function forecastMonth(input: ForecastInput, previousTotalsCents: number[] = []): Forecast {
  const { today, daysInMonth, recurringCents, upcomingRecurringCents, variableSoFarCents, plannedVariableCents, previousVariableCents } = input;
  const elapsed = Math.min(Math.max(today, 1), daysInMonth);
  const pace = (variableSoFarCents / elapsed) * daysInMonth;
  const history = previousVariableCents.length ? previousVariableCents.reduce((a, b) => a + b, 0) / previousVariableCents.length : null;
  const weight = elapsed / daysInMonth;
  const blended = history === null ? pace : weight * pace + (1 - weight) * history;
  // What's already spent or planned is a floor, whatever the history says.
  const variable = Math.max(blended, variableSoFarCents + plannedVariableCents);

  return {
    spentCents: recurringCents - upcomingRecurringCents + variableSoFarCents,
    upcomingRecurringCents,
    projectedCents: Math.round(recurringCents + variable),
    usualCents: previousTotalsCents.length ? Math.round(previousTotalsCents.reduce((a, b) => a + b, 0) / previousTotalsCents.length) : null,
  };
}
