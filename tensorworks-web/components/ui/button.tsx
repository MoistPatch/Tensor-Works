"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tw-blue)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--tw-blue)] text-white hover:bg-[var(--tw-blue-dark)]",
        secondary:
          "bg-[var(--tw-bg)] text-[var(--tw-dark)] hover:bg-[var(--tw-border)]",
        outline:
          "border border-[var(--tw-border)] bg-transparent text-[var(--tw-dark)] hover:bg-[var(--tw-bg)]",
        ghost:
          "bg-transparent text-[var(--tw-dark)] hover:bg-[var(--tw-bg)]",
        accent:
          "bg-[var(--tw-green)] text-white hover:bg-[var(--tw-green-dark)]",
        destructive:
          "bg-red-600 text-white hover:bg-red-700",
        link:
          "text-[var(--tw-blue)] underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded px-3 text-xs",
        lg: "h-12 rounded-lg px-6 text-base",
        xl: "h-14 rounded-lg px-8 text-base font-semibold",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
