import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-[22px] w-[22px] text-[9.5px]",
  md: "h-7 w-7 text-[11px]",
  lg: "h-9 w-9 text-[13px]",
} as const;

export type AvatarSize = keyof typeof SIZES;

export function Avatar({
  initials,
  size = "md",
  className,
}: {
  initials: string;
  size?: AvatarSize;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid place-items-center rounded-full bg-cp-blue-dark font-semibold tracking-wide text-white shrink-0",
        SIZES[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}

/** Lager initialer fra et fullt navn — "Helle Berg" → "HB". */
export function nameToInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
