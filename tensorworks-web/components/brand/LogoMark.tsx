import { cn } from "@/lib/utils";

interface LogoMarkProps {
  className?: string;
  size?: number;
}

export function LogoMark({ className, size = 40 }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("flex-shrink-0", className)}
    >
      {/* Hexagon background */}
      <path
        d="M20 2L36.5 11.5V29.5L20 39L3.5 29.5V11.5L20 2Z"
        fill="var(--tw-blue)"
      />
      {/* T mark */}
      <path
        d="M11 14H29V18H22V27H18V18H11V14Z"
        fill="white"
      />
      {/* W accent dot */}
      <circle cx="26" cy="27" r="2.5" fill="var(--tw-green)" />
    </svg>
  );
}
