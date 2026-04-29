import { cn } from "@/lib/utils";

export type SoknadStatus =
  | "kladd"
  | "vurdert"
  | "sendt"
  | "innvilget"
  | "avslag";

const STATUS_MAP: Record<SoknadStatus, { label: string; cls: string }> = {
  kladd: { label: "Kladd", cls: "bg-line-2 text-ink-3" },
  vurdert: { label: "Vurdert", cls: "bg-sky-100 text-sky-900" },
  sendt: { label: "Sendt til DAM", cls: "bg-cp-blue-soft text-cp-blue-dark" },
  innvilget: { label: "Innvilget", cls: "bg-good-soft text-green-900" },
  avslag: { label: "Avslått", cls: "bg-cp-red-soft text-cp-red" },
};

export function StatusChip({
  status,
  className,
}: {
  status: SoknadStatus;
  className?: string;
}) {
  const it = STATUS_MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-[2px] text-[11.5px] font-medium",
        it.cls,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {it.label}
    </span>
  );
}
