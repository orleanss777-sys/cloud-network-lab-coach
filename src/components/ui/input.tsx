import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-10 w-full rounded-md bg-surface-2 px-3 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:opacity-40",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";
