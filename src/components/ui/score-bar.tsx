import { cn } from "@/lib/utils";

export function ScoreBar({
  value,
  max = 7,
  className,
}: {
  value: number;
  max?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 text-[13px] font-semibold tabular",
        className,
      )}
    >
      {value.toFixed(1)}{" "}
      <em className="not-italic font-medium text-[11.5px] text-ink-5">
        / {max}
      </em>
      <span className="ml-2 inline-block h-1 w-14 overflow-hidden rounded bg-line-2">
        <span
          className="block h-full bg-cp-blue"
          style={{ width: `${pct}%` }}
        />
      </span>
    </span>
  );
}
