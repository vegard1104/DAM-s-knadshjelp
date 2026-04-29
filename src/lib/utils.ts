import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Kombinerer Tailwind-klasser og fjerner duplikater.
 * Brukes overalt i UI-komponenter.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Norsk tallformatering med tusenseparator */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat("nb-NO").format(n);
}

/** Norsk valutaformatering, 0 desimaler */
export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Norsk dato dd.mm.yyyy */
export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
