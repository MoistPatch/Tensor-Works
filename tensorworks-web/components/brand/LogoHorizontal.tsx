import { cn } from "@/lib/utils";
import { LogoMark } from "./LogoMark";

interface LogoHorizontalProps {
  className?: string;
  markSize?: number;
  inverted?: boolean;
}

export function LogoHorizontal({
  className,
  markSize = 36,
  inverted = false,
}: LogoHorizontalProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-label="TensorWorks"
    >
      <LogoMark size={markSize} />
      <span
        className={cn(
          "font-bold tracking-tight leading-none select-none",
          inverted ? "text-white" : "text-[var(--tw-dark)]"
        )}
        style={{ fontSize: markSize * 0.55 }}
      >
        Tensor<span className="text-[var(--tw-blue)]">Works</span>
      </span>
    </span>
  );
}
