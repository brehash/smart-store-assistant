import { PipelineStep, type PipelineStepData } from "./PipelineStep";

export interface PipelinePlanData {
  title: string;
  steps: PipelineStepData[];
}

export function PipelinePlan({ plan }: { plan: PipelinePlanData }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 my-2 w-full max-w-[520px]">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {plan.title}
      </p>
      <div>
        {plan.steps.map((step) => (
          <PipelineStep key={step.id} step={step} />
        ))}
      </div>
    </div>
  );
}
