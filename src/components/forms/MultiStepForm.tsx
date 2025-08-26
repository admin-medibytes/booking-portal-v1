import { Check, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

interface MultiStepFormProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function MultiStepForm({ steps, currentStep, onStepClick }: MultiStepFormProps) {
  // Calculate progress percentage
  const progress = ((currentStep - 1) / (steps.length - 1)) * 100;

  return (
    <div className="mb-12">
      <div className="relative">
        {/* Progress Bar Background */}
        <div className="absolute top-6 left-0 right-0 h-0.5 bg-slate-200 rounded-full" />
        {/* Active Progress Bar */}
        <div
          className="absolute top-6 left-0 h-0.5 bg-gradient-to-r from-primary to-primary rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />

        {/* Step Indicators */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isActive = stepNumber === currentStep;
            const isCompleted = stepNumber < currentStep;
            const isClickable = onStepClick && stepNumber < currentStep;
            const Icon = step.icon;

            return (
              <div key={step.id} className="flex flex-col items-center group">
                {/* Step Circle */}
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick(stepNumber)}
                  disabled={!isClickable}
                  className={cn(
                    "relative flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-300",
                    isCompleted
                      ? "bg-gradient-to-r from-green-500 to-green-600 border-green-500 text-white shadow-lg shadow-green-500/25"
                      : isActive
                      ? "bg-gradient-to-r from-primary to-primary border-primary text-white shadow-lg shadow-primary/25 scale-110"
                      : "bg-white border-slate-300 text-slate-400 group-hover:border-slate-400",
                    isClickable && "cursor-pointer",
                    !isClickable && "cursor-default"
                  )}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}

                  {/* Active Step Pulse Animation */}
                  {isActive && (
                    <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-20" />
                  )}
                </button>

                {/* Step Content */}
                <div className="mt-4 text-center max-w-32">
                  <p
                    className={cn(
                      "text-sm font-medium transition-colors duration-200",
                      isActive || isCompleted ? "text-slate-900" : "text-slate-500"
                    )}
                  >
                    {step.title}
                  </p>
                  <p
                    className={cn(
                      "text-xs mt-1 transition-colors duration-200",
                      isActive || isCompleted ? "text-slate-600" : "text-slate-400"
                    )}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
