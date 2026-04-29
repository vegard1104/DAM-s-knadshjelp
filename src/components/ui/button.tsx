import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cp-blue/15 focus-visible:border-cp-blue",
  {
    variants: {
      variant: {
        primary:
          "bg-cp-blue text-white border border-cp-blue hover:bg-cp-blue-dark hover:border-cp-blue-dark shadow-cp-sm",
        secondary:
          "bg-white text-ink-2 border border-line-1 hover:bg-bg-sunk hover:border-ink-5/40",
        ghost:
          "bg-transparent text-ink-3 border border-transparent hover:bg-line-3 hover:text-ink-1",
        danger:
          "bg-cp-red-tint text-cp-red border border-cp-red-soft hover:bg-cp-red-soft hover:border-cp-red/30",
      },
      size: {
        sm: "px-2.5 py-1.5 text-[12.5px]",
        md: "px-3.5 py-2 text-[13px]",
        lg: "px-4.5 py-2.5 text-[14px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
