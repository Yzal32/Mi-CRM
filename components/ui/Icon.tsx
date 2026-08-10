import {
  AlertCircle,
  ArrowLeft,
  BarChart2,
  Calendar,
  CalendarCheck,
  Check,
  ChevronRight,
  HelpCircle,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  Settings,
  Star,
  Users,
  Wallet,
  WifiOff,
  X,
  type LucideProps,
} from "lucide-react";

const ICONS = {
  "alert-circle": AlertCircle,
  "arrow-left": ArrowLeft,
  "bar-chart-2": BarChart2,
  calendar: Calendar,
  "calendar-check": CalendarCheck,
  check: Check,
  "chevron-right": ChevronRight,
  "help-circle": HelpCircle,
  mail: Mail,
  "map-pin": MapPin,
  "message-circle": MessageCircle,
  pencil: Pencil,
  phone: Phone,
  plus: Plus,
  search: Search,
  settings: Settings,
  star: Star,
  users: Users,
  wallet: Wallet,
  "wifi-off": WifiOff,
  x: X,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, strokeWidth = 1.75, ...rest }: { name: IconName } & LucideProps) {
  const LucideIcon = ICONS[name];
  return <LucideIcon size={size} strokeWidth={strokeWidth} {...rest} />;
}
