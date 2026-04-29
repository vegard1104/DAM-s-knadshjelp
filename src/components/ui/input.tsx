import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  flagged?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, flagged, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-md border bg-white px-3 py-2.5 text-[13.5px] text-ink-1 transition placeholder:text-ink-5",
        "focus:outline-none focus:ring-[3px] focus:ring-cp-blue/15 focus:border-cp-blue",
        flagged
          ? "border-red-300 bg-cp-red-tint focus:border-cp-red focus:ring-cp-red/15"
          : "border-line-1",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
