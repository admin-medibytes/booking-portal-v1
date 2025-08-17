import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  title: string;
  description: string;
}

interface MultiStepFormProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function MultiStepForm({ steps, currentStep, onStepClick }: MultiStepFormProps) {
  return (
    <nav aria-label="Progress">
      <ol role="list" className="flex items-center">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;
          const isClickable = onStepClick && stepNumber < currentStep;

          return (
            <li
              key={step.id}
              className={cn(
                "relative",
                index !== steps.length - 1 && "pr-8 sm:pr-20 flex-1"
              )}
            >
              {index !== steps.length - 1 && (
                <div
                  className="absolute inset-0 flex items-center"
                  aria-hidden="true"
                >
                  <div
                    className={cn(
                      "h-0.5 w-full",
                      isCompleted ? "bg-primary" : "bg-muted"
                    )}
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => isClickable && onStepClick(stepNumber)}
                disabled={!isClickable}
                className={cn(
                  "relative flex items-center",
                  isClickable && "cursor-pointer hover:opacity-80",
                  !isClickable && "cursor-default"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm",
                    isActive && "bg-primary text-primary-foreground",
                    isCompleted && "bg-primary text-primary-foreground",
                    !isActive && !isCompleted && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    stepNumber
                  )}
                </span>
                <span className="ml-3 text-sm font-medium hidden sm:block">
                  <span
                    className={cn(
                      isActive && "text-foreground",
                      !isActive && "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </span>
                  {step.description && (
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {step.description}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}