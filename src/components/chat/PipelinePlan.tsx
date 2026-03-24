import { PipelineStep, type PipelineStepData } from "./PipelineStep";

export interface PipelinePlanData {
  title: string;
  steps: PipelineStepData[];
}

export function PipelinePlan({ plan }: { plan: PipelinePlanData }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 my-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {plan.title}
      </p>
      <div>
        {plan.steps.map((step, i) => (
          <PipelineStep key={step.id} step={step} isLast={i === plan.steps.length - 1} />
        ))}
      </div>
    </div>
  );
}
