import { cn } from "@/lib/utils";
import { LogoMark } from "./LogoMark";

interface LogoVerticalProps {
  className?: string;
  markSize?: number;
  inverted?: boolean;
}

export function LogoVertical({
  className,
  markSize = 48,
  inverted = false,
}: LogoVerticalProps) {
  return (
    <span
      className={cn("inline-flex flex-col items-center gap-2", className)}
      aria-label="TensorWorks"
    >
      <LogoMark size={markSize} />
      <span
        className={cn(
          "font-bold tracking-tight leading-none select-none",
          inverted ? "text-white" : "text-[var(--tw-dark)]"
        )}
        style={{ fontSize: markSize * 0.45 }}
      >
        Tensor<span className="text-[var(--tw-blue)]">Works</span>
      </span>
    </span>
  );
}
