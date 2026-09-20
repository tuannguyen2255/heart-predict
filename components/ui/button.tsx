import { cn } from "@/lib/utils";
import { forwardRef, ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
          {
            "bg-primary text-primary-foreground hover:bg-primary/90": variant === "default",
            "bg-teal-700 text-white hover:bg-teal-800": variant === "secondary",
            "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50": variant === "outline",
            "text-slate-600 hover:bg-slate-100 hover:text-slate-950": variant === "ghost",
            "bg-destructive text-destructive-foreground hover:bg-destructive/90": variant === "destructive",
          },
          {
            "h-11 px-5 py-2.5": size === "default",
            "h-9 rounded-lg px-3.5 text-sm": size === "sm",
            "h-12 rounded-md px-7 text-base": size === "lg",
            "h-10 w-10 rounded-md": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
