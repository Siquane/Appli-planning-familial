// Icons ported 1:1 (same viewBox + path data) from the inline SVGs in
// design source file, so the app matches the approved design exactly
// rather than swapping in a generic icon set.
import Svg, { Circle, Path, Rect } from "react-native-svg";

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function ChevronLeftIcon({ size = 17, color = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5l-7 7 7 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 14, color = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 5l7 7-7 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function EditIcon({ size = 16, color = "currentColor" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 20l1-4L16 5l3 3-11 11-4 1z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CopyIcon({ size = 16, color = "currentColor" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={9} y={9} width={11} height={11} rx={2} stroke={color} strokeWidth={1.8} />
      <Path d="M15 9V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2h3" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function TrashIcon({ size = 16, color = "currentColor" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CheckIcon({ size = 15, color = "currentColor" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 13l4 4 10-10" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function BellIcon({ size = 20, color = "currentColor" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 10a6 6 0 1112 0c0 3.5 1 5.5 2 7H4c1-1.5 2-3.5 2-7z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9.5 20a2.5 2.5 0 005 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CalendarIcon({ size = 16, color = "currentColor" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={6} width={16} height={14} rx={2} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 10h16M8 4v4M16 4v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ClockIcon({ size = 16, color = "currentColor" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 8v4l3 2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ReshuffleIcon({ size = 15, color = "currentColor" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 8h11l-2.5-2.5M20 16H9l2.5 2.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Circular-arrow "recurs every week" marker (↻), distinct from
// ReshuffleIcon (crossed arrows = "replan"/swap slots).
export function RecurringIcon({ size = 12, color = "currentColor" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18.7 3.5V7h-3.5M5.3 20.5V17h3.5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function DeadlineIcon({ size = 16, color = "currentColor" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2l3 6 6 1-4.5 4.5L17 20l-5-3-5 3 1.5-6.5L4 9l6-1z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SearchIcon({ size = 20, color = "currentColor" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={10.5} cy={10.5} r={6.5} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M20 20l-4.8-4.8" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function HomeIcon({ size = 20, color = "currentColor" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 11l9-8 9 8" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 10v10h14V10" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9.5 20v-6h5v6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PlusIcon({ size = 20, color = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ProfileIcon({ size = 20, color = "currentColor" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={3.6} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4.5 20c1.2-4 4-6 7.5-6s6.3 2 7.5 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CloseIcon({ size = 14, color = "currentColor" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function GiftIcon({ size = 16, color = "currentColor" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="9" width="16" height="11" rx="1" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M4 9h16v4H4z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M12 9v11M12 9c-1.5-3-5.5-3.5-5.5-.8C6.5 9.7 8.5 9 12 9zM12 9c1.5-3 5.5-3.5 5.5-.8 0 1.5-2 .8-5.5.8z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function BookIcon({ size = 16, color = "currentColor" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 4.5C5 3.7 5.7 3 6.5 3H19v15.5H6.5c-.8 0-1.5.7-1.5 1.5V4.5z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M5 18v1.5c0 .8.7 1.5 1.5 1.5H19" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function DocumentIcon({ size = 16, color = "currentColor" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 3v5h5M9 13h6M9 17h4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function WalletIcon({ size = 16, color = "currentColor" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4h-12A2.5 2.5 0 0 0 3 6.5v11A2.5 2.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 6.5A2.5 2.5 0 0 0 5.5 9H20v6h-4a3 3 0 0 1 0-6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// A steaming bowl: clean geometric lines that stay legible at tab size.
export function MealIcon({ size = 16, color = "currentColor" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12h16a8 8 0 0 1-16 0z" fill={color} fillOpacity={0.3} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8.5 8c-.8-1 .8-2 0-3.2M12 8c-.8-1 .8-2 0-3.2M15.5 8c-.8-1 .8-2 0-3.2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 20.5h6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Chef's toque (Repas+): three symmetric puffs over a plain band. Thin strokes
// on purpose (the offer icons sit next to text, not in the tab bar).
export function ToqueIcon({ size = 16, color = "currentColor" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7.4 14.6A3.8 3.8 0 0 1 9.2 7.6a3.2 3.2 0 0 1 5.6 0 3.8 3.8 0 0 1 1.8 7z"
        fill={color}
        fillOpacity={0.2}
        stroke={color}
        strokeWidth={1.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M7.4 14.6v4.4c0 .6.4 1 1 1h7.2c.6 0 1-.4 1-1v-4.4" stroke={color} strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Piggy bank (Budget+): rounded body, snout, ear, curly tail, a coin above the slot.
export function PiggyBankIcon({ size = 16, color = "currentColor" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.8 13.2c0-3.3 3.2-5.6 7-5.6 2.5 0 4.6.9 5.8 2.3h1.6c.5 0 .8.3.8.8v2.6c0 .5-.3.8-.8.8h-1.1c-.5 1.3-1.4 2.3-2.6 3v2.3c0 .4-.3.7-.7.7h-1.1c-.4 0-.7-.3-.7-.7V18c-.5.1-1 .2-1.4.2-.7 0-1.4-.1-2-.2v1.4c0 .4-.3.7-.7.7H8c-.4 0-.7-.3-.7-.7v-2.5c-1.5-.9-2.5-2.2-2.5-3.7z"
        fill={color}
        fillOpacity={0.2}
        stroke={color}
        strokeWidth={1.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14.5 8.1c.2-1 .7-1.8 1.4-2.2.4.7.6 1.6.6 2.7M10 9.8h3M4.8 12.6c-.9 0-1.4-.6-1.2-1.3"
        stroke={color}
        strokeWidth={1.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={11.5} cy={4.4} r={1.7} stroke={color} strokeWidth={1.1} />
      <Circle cx={16.9} cy={11.4} r={0.65} fill={color} />
    </Svg>
  );
}

export function SearchEmptyIcon({ size = 26, color = "currentColor" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={10.5} cy={10.5} r={6.5} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M20 20l-4.8-4.8" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
