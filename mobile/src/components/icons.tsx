// Passerelle's own icon set: one 24 × 24 grid, round caps and joins, a thin
// line and a light tint inside the main shape (like the Repas+ toque).
// The line keeps the same on-screen thickness at every size: its width in
// viewBox units is LINE_PX scaled to the drawn size (0.6 at 56 px, ~1.7 at
// 20 px), capped so tiny icons stay legible.
import Svg, { Circle, Path } from "react-native-svg";

interface IconProps {
  size?: number;
  color?: string;
}

type Part =
  | { kind: "path"; d: string; tint?: boolean }
  | { kind: "ring"; cx: number; cy: number; r: number; tint?: boolean }
  | { kind: "dot"; cx: number; cy: number; r: number };

const LINE_PX = 1.4;
const TINT = 0.18;

export function lineWidth(size: number) {
  return Math.min(2.4, (LINE_PX * 24) / size);
}

function makeIcon(parts: Part[], defaultSize: number) {
  return function Icon({ size = defaultSize, color = "currentColor" }: IconProps) {
    const sw = lineWidth(size);
    const fill = (tint?: boolean) => (tint ? { fill: color, fillOpacity: TINT } : { fill: "none" });
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {parts.map((p, i) =>
          p.kind === "path" ? (
            <Path key={i} d={p.d} {...fill(p.tint)} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          ) : p.kind === "ring" ? (
            <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} {...fill(p.tint)} stroke={color} strokeWidth={sw} />
          ) : (
            <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={color} />
          ),
        )}
      </Svg>
    );
  };
}

// Back
export const ChevronLeftIcon = makeIcon(
  [
  { kind: "path", d: "M14.5 5.5L8 12l6.5 6.5" },
  ],
  17,
);

// Next, and the arrow ending a text link
export const ChevronRightIcon = makeIcon(
  [
  { kind: "path", d: "M9.5 5.5L16 12l-6.5 6.5" },
  ],
  14,
);

// Add
export const PlusIcon = makeIcon(
  [
  { kind: "path", d: "M12 5v14M5 12h14" },
  ],
  20,
);

// Close / remove
export const CloseIcon = makeIcon(
  [
  { kind: "path", d: "M6.5 6.5l11 11M17.5 6.5l-11 11" },
  ],
  14,
);

// Done / included
export const CheckIcon = makeIcon(
  [
  { kind: "path", d: "M5 12.5l4.5 4.5L19 7.5" },
  ],
  15,
);

// Search
export const SearchIcon = makeIcon(
  [
  { kind: "ring", cx: 10.5, cy: 10.5, r: 6.5, tint: true },
  { kind: "path", d: "M15.3 15.3L20 20" },
  ],
  20,
);

// Notifications
export const BellIcon = makeIcon(
  [
  { kind: "path", d: "M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.8h-15z", tint: true },
  { kind: "path", d: "M10 20.5a2 2 0 0 0 4 0M12 3.3V5" },
  ],
  20,
);

// Planning tab, dates
export const CalendarIcon = makeIcon(
  [
  { kind: "path", d: "M6.5 5h11a3 3 0 0 1 3 3v9.5a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z", tint: true },
  { kind: "path", d: "M3.5 10h17M8 3v4M16 3v4" },
  { kind: "dot", cx: 12, cy: 15, r: 1.1 },
  ],
  16,
);

// Time
export const ClockIcon = makeIcon(
  [
  { kind: "ring", cx: 12, cy: 12, r: 8.5, tint: true },
  { kind: "path", d: "M12 7.5V12l3 2" },
  ],
  16,
);

// Edit
export const EditIcon = makeIcon(
  [
  { kind: "path", d: "M4.5 19.5l1-4.3L15.7 5a2 2 0 0 1 2.8 0l.5.5a2 2 0 0 1 0 2.8L8.8 18.5z", tint: true },
  { kind: "path", d: "M13.5 7.2l3.3 3.3" },
  ],
  16,
);

// Copy
export const CopyIcon = makeIcon(
  [
  { kind: "path", d: "M11 8.5h6a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5h-6A2.5 2.5 0 0 1 8.5 17v-6A2.5 2.5 0 0 1 11 8.5z", tint: true },
  { kind: "path", d: "M15.5 8.5V7A2.5 2.5 0 0 0 13 4.5H7A2.5 2.5 0 0 0 4.5 7v6A2.5 2.5 0 0 0 7 15.5h1.5" },
  ],
  16,
);

// Delete
export const TrashIcon = makeIcon(
  [
  { kind: "path", d: "M6.5 7l.9 11.6a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9L17.5 7", tint: true },
  { kind: "path", d: "M4.5 7h15M9.5 7V5.3c0-.5.4-.8.8-.8h3.4c.4 0 .8.3.8.8V7M10.5 11v5M13.5 11v5" },
  ],
  16,
);

// « Autre idée » / swap
export const ReshuffleIcon = makeIcon(
  [
  { kind: "path", d: "M4 8h12.5M13.5 5l3 3-3 3M20 16H7.5M10.5 13l-3 3 3 3" },
  ],
  15,
);

// Repeats every week
export const RecurringIcon = makeIcon(
  [
  { kind: "path", d: "M19.5 12a7.5 7.5 0 1 1-2.2-5.3" },
  { kind: "path", d: "M19.5 4.5V8.5h-4" },
  ],
  12,
);

// Deadline
export const DeadlineIcon = makeIcon(
  [
  { kind: "path", d: "M12 3.5l2.5 5.2 5.6.8-4.1 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8z", tint: true },
  ],
  16,
);

// Famille tab, a person
export const ProfileIcon = makeIcon(
  [
  { kind: "ring", cx: 12, cy: 8.3, r: 3.8, tint: true },
  { kind: "path", d: "M4.5 20c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6" },
  ],
  20,
);

// Gift
// Étoile à 5 branches (étoiles des enfants).
export const StarIcon = makeIcon(
  [{ kind: "path", d: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z", tint: true }],
  16,
);

export const GiftIcon = makeIcon(
  [
  { kind: "path", d: "M5.5 12.5h13v6.5a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19z", tint: true },
  { kind: "path", d: "M4.5 9h15v3.5h-15zM12 9v11.5M12 9C11 6.2 7.5 4.8 7.5 7c0 1.7 2.5 2 4.5 2s4.5-.3 4.5-2c0-2.2-3.5-.8-4.5 2" },
  ],
  16,
);

// Recipes
export const BookIcon = makeIcon(
  [
  { kind: "path", d: "M4.5 5.5c2.5-1 5-1 7.5.8 2.5-1.8 5-1.8 7.5-.8V19c-2.5-1-5-1-7.5.8-2.5-1.8-5-1.8-7.5-.8z", tint: true },
  { kind: "path", d: "M12 6.3v13.5" },
  ],
  16,
);

// Documents
export const DocumentIcon = makeIcon(
  [
  { kind: "path", d: "M6.5 3.5h7l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z", tint: true },
  { kind: "path", d: "M13.5 3.5V8h4.5M8.5 12.5h7M8.5 16h5" },
  ],
  16,
);

// Budget tab
export const WalletIcon = makeIcon(
  [
  { kind: "path", d: "M6.5 8h11a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5H16v3", tint: true },
  { kind: "dot", cx: 16.2, cy: 14, r: 1.1 },
  ],
  16,
);

// Repas tab: a steaming bowl (the original design, in the shared line style).
export const MealIcon = makeIcon(
  [
  { kind: "path", d: "M4 12h16a8 8 0 0 1-16 0z", tint: true },
  { kind: "path", d: "M8.5 8c-.8-1 .8-2 0-3.2M12 8c-.8-1 .8-2 0-3.2M15.5 8c-.8-1 .8-2 0-3.2M9 20.5h6" },
  ],
  16,
);

// Repas+
export const ToqueIcon = makeIcon(
  [
  { kind: "path", d: "M7.4 14.6A3.8 3.8 0 0 1 9.2 7.6a3.2 3.2 0 0 1 5.6 0 3.8 3.8 0 0 1 1.8 7z", tint: true },
  { kind: "path", d: "M7.4 14.6v4.4c0 .6.4 1 1 1h7.2c.6 0 1-.4 1-1v-4.4" },
  ],
  16,
);

// Budget+
export const PiggyBankIcon = makeIcon(
  [
  { kind: "path", d: "M4.8 13.2c0-3.3 3.2-5.6 7-5.6 2.5 0 4.6.9 5.8 2.3l.3.7h.9c.4 0 .6.2.6.6v1.6c0 .4-.2.6-.6.6h-.8c-.5 1.5-1.2 2.8-2.3 3.7v2.3c0 .4-.3.7-.7.7h-1.1c-.4 0-.7-.3-.7-.7V18c-.5.1-1 .2-1.4.2-.7 0-1.4-.1-2-.2v1.4c0 .4-.3.7-.7.7H8c-.4 0-.7-.3-.7-.7v-2.5c-1.5-.9-2.5-2.2-2.5-3.7z", tint: true },
  { kind: "path", d: "M14.5 8.1c.2-1 .7-1.8 1.4-2.2.4.7.6 1.6.6 2.7M10 9.8h3M4.8 12.6c-.9 0-1.4-.6-1.2-1.3" },
  { kind: "ring", cx: 11.5, cy: 4.4, r: 1.7 },
  { kind: "dot", cx: 16.4, cy: 11.3, r: 0.6 },
  ],
  16,
);

// Savings goals
export const TargetIcon = makeIcon(
  [
  { kind: "ring", cx: 11, cy: 13, r: 7.5, tint: true },
  { kind: "ring", cx: 11, cy: 13, r: 4 },
  { kind: "dot", cx: 11, cy: 13, r: 1.2 },
  { kind: "path", d: "M11 13l7-7M16 4v4h4" },
  ],
  16,
);

// Budget report
export const ChartIcon = makeIcon(
  [
  { kind: "path", d: "M4 4.5v15.5h16" },
  { kind: "path", d: "M7.5 15l3.5-4 3 2.5 5-6" },
  { kind: "path", d: "M15.5 7.5H19V11" },
  ],
  16,
);

// Generated by Claude, paid offers
export const SparkleIcon = makeIcon(
  [
  { kind: "path", d: "M11 3.5c.6 3.9 2 5.3 5.8 6-3.8.7-5.2 2.1-5.8 6-.6-3.9-2-5.3-5.8-6 3.8-.7 5.2-2.1 5.8-6z", tint: true },
  { kind: "path", d: "M18 14.5c.3 1.5.8 2 2.3 2.3-1.5.3-2 .8-2.3 2.3-.3-1.5-.8-2-2.3-2.3 1.5-.3 2-.8 2.3-2.3z" },
  ],
  16,
);

// Celebration (goal reached, birthday today)
export const PartyIcon = makeIcon(
  [
  { kind: "path", d: "M4 20.5l4.3-11.8 7.5 7.5z", tint: true },
  { kind: "path", d: "M13 4v2.2M19.8 11H17.6M16.7 7.3l1.6-1.6M10.5 8.5c.8-1.6 2.6-2 3-3.6M15.5 13.5c1.6-.8 2-2.6 3.6-3" },
  { kind: "dot", cx: 20, cy: 4.5, r: 0.9 },
  ],
  16,
);

// Birthday
export const CakeIcon = makeIcon(
  [
  { kind: "path", d: "M5 20.5V13a1.5 1.5 0 0 1 1.5-1.5h11A1.5 1.5 0 0 1 19 13v7.5", tint: true },
  { kind: "path", d: "M3.5 20.5h17M5 15.5c1.2 1 2.3 1 3.5 0s2.3-1 3.5 0 2.3 1 3.5 0 2.3-1 3.5 0M9 11.5v-3M15 11.5v-3M9 6.5c.7-.6.7-1.4 0-2.2-.7.8-.7 1.6 0 2.2zM15 6.5c.7-.6.7-1.4 0-2.2-.7.8-.7 1.6 0 2.2z" },
  ],
  16,
);

// Warning (spending cap)
export const WarningIcon = makeIcon(
  [
  { kind: "path", d: "M10.3 4.9a2 2 0 0 1 3.4 0l7.2 12.6a2 2 0 0 1-1.7 3H4.8a2 2 0 0 1-1.7-3z", tint: true },
  { kind: "path", d: "M12 10v4" },
  { kind: "dot", cx: 12, cy: 17, r: 1 },
  ],
  16,
);

// Greeting
export const WaveIcon = makeIcon(
  [
  { kind: "path", d: "M8.5 11.5V6.3a1.3 1.3 0 0 1 2.6 0v4.7M11.1 10V4.8a1.3 1.3 0 0 1 2.6 0V10M13.7 10.2V6a1.3 1.3 0 0 1 2.6 0v6.8M8.5 11.5l-1-1.4a1.4 1.4 0 0 0-2.3 1.6l2.6 4.4c1.4 2.4 3.3 3.9 6 3.9 2.6 0 4.5-2.1 4.5-5V9.3a1.3 1.3 0 0 0-2.6 0", tint: true },
  ],
  16,
);

// Empty search results: the search glass, larger.
export function SearchEmptyIcon({ size = 26, color }: IconProps) {
  return <SearchIcon size={size} color={color} />;
}

// List bullet: a small tinted ring, in place of « • ».
export function BulletIcon({ size = 8, color = "currentColor" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 8 8">
      <Circle cx={4} cy={4} r={2.6} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={1} />
    </Svg>
  );
}
