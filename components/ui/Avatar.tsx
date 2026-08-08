const HUES = [165, 250, 300, 85, 20];

function hueFor(name: string): number {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return HUES[sum % HUES.length];
}

function initialsFor(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const hue = hueFor(name);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-circle font-body-medium"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `oklch(0.92 0.05 ${hue})`,
        color: `oklch(0.45 0.12 ${hue})`,
      }}
    >
      {initialsFor(name)}
    </div>
  );
}
