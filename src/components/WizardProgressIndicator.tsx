'use client'

interface WizardStep {
  number: number
  label: string
  shortLabel?: string
}

interface WizardProgressIndicatorProps {
  steps: WizardStep[]
  currentStep: number
  onStepClick?: (step: number) => void
  allowNavigation?: boolean
}

export default function WizardProgressIndicator({
  steps,
  currentStep,
  onStepClick,
  allowNavigation = false,
}: WizardProgressIndicatorProps) {
  return (
    <div className="w-full px-4 py-3">
      <div className="flex items-center justify-center max-w-md mx-auto">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.number
          const isCurrent = currentStep === step.number
          const isClickable = allowNavigation && onStepClick && currentStep > step.number

          return (
            <div key={step.number} className="flex items-center flex-1 last:flex-initial">
              {/* Step circle and label */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick(step.number)}
                  disabled={!isClickable}
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-200
                    ${isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                        ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                        : 'bg-gray-200 text-gray-500'
                    }
                    ${isClickable ? 'cursor-pointer hover:ring-2 hover:ring-indigo-300' : 'cursor-default'}
                  `}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.number
                  )}
                </button>
                <span
                  className={`
                    mt-1.5 text-xs font-medium text-center whitespace-nowrap
                    ${isCurrent ? 'text-indigo-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}
                  `}
                >
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{step.shortLabel || step.label}</span>
                </span>
              </div>

              {/* Connector line (not after last step) */}
              {index < steps.length - 1 && (
                <div className="flex-1 mx-2 sm:mx-3">
                  <div
                    className={`
                      h-1 rounded-full transition-colors duration-200
                      ${currentStep > step.number ? 'bg-green-500' : 'bg-gray-200'}
                    `}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
