import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--tw-blue)] text-white",
        secondary:
          "bg-[var(--tw-bg)] text-[var(--tw-dark)] border border-[var(--tw-border)]",
        accent:
          "bg-[var(--tw-green)] text-white",
        outline:
          "border border-[var(--tw-border)] text-[var(--tw-dark)]",
        destructive:
          "bg-red-100 text-red-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
