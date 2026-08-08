import {
  AlertCircle,
  ArrowLeft,
  BarChart2,
  CalendarCheck,
  ChevronRight,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Settings,
  Users,
  WifiOff,
  type LucideProps,
} from "lucide-react";

const ICONS = {
  "alert-circle": AlertCircle,
  "arrow-left": ArrowLeft,
  "bar-chart-2": BarChart2,
  "calendar-check": CalendarCheck,
  "chevron-right": ChevronRight,
  mail: Mail,
  "map-pin": MapPin,
  "message-circle": MessageCircle,
  phone: Phone,
  plus: Plus,
  search: Search,
  settings: Settings,
  users: Users,
  "wifi-off": WifiOff,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, strokeWidth = 1.75, ...rest }: { name: IconName } & LucideProps) {
  const LucideIcon = ICONS[name];
  return <LucideIcon size={size} strokeWidth={strokeWidth} {...rest} />;
}
