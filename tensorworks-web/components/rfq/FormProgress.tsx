import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface FormProgressProps {
  currentStep: number;
  totalSteps: number;
  steps: string[];
}

export function FormProgress({ currentStep, totalSteps, steps }: FormProgressProps) {
  return (
    <nav aria-label="Form progress" className="mb-8">
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const stepNum = index + 1;
          const isDone = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;

          return (
            <li
              key={step}
              className={cn(
                "flex items-center",
                index < steps.length - 1 && "flex-1"
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-colors",
                    isDone && "bg-[var(--tw-green)] text-white",
                    isCurrent && "bg-[var(--tw-blue)] text-white",
                    !isDone && !isCurrent && "bg-[var(--tw-bg)] text-[var(--tw-muted)] border border-[var(--tw-border)]"
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isDone ? <Check className="h-4 w-4" /> : stepNum}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium hidden sm:block",
                    isCurrent && "text-[var(--tw-dark)]",
                    !isCurrent && "text-[var(--tw-muted)]"
                  )}
                >
                  {step}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-px mx-3 transition-colors",
                    isDone ? "bg-[var(--tw-green)]" : "bg-[var(--tw-border)]"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
