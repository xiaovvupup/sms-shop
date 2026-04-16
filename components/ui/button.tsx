import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/core/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-[#1A2322] via-[#2B3526] to-[#4A5838] text-primary-foreground shadow-[0_10px_26px_-14px_rgba(20,30,22,0.7)] hover:brightness-110 hover:shadow-[0_14px_30px_-16px_rgba(20,30,22,0.78)]",
        secondary:
          "border border-white/60 bg-white/70 text-secondary-foreground shadow-[0_8px_20px_-16px_rgba(20,30,22,0.5)] hover:bg-white/85",
        outline:
          "border border-border bg-transparent text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] hover:bg-muted/60",
        ghost: "hover:bg-muted/70"
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-4",
        lg: "h-12 px-6"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
