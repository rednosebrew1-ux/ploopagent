'use client';

import type { Plan } from '@/lib/store';
import { useEffect, useState } from 'react';

const STATUS_ICON: Record<Plan['steps'][number]['status'], string> = {
  pending: '○',
  'in-progress': '◐',
  done: '●',
  blocked: '!',
  skipped: '–',
};

export default function PlanPanel({ refreshKey }: { refreshKey: unknown }) {
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/plans')
      .then(response => response.json())
      .then((data: { plans: Plan[] }) => {
        if (!cancelled) setPlans(data.plans);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <aside className="w-full text-sm md:w-72">
      <h2 className="mb-2 font-semibold">Plans</h2>
      {plans.length === 0 && (
        <p className="text-gray-500">
          Give ploop a goal and its plan will show up here.
        </p>
      )}
      {plans.map(plan => (
        <div key={plan.id} className="mb-4">
          <div className="mb-1 font-medium">{plan.goal}</div>
          <ol className="space-y-1">
            {plan.steps.map((step, index) => (
              <li key={index} className="flex gap-2">
                <span className="w-3 text-gray-500">
                  {STATUS_ICON[step.status]}
                </span>
                <span
                  className={
                    step.status === 'done' || step.status === 'skipped'
                      ? 'text-gray-400 line-through'
                      : ''
                  }
                >
                  {step.title}
                  {step.note && (
                    <span className="block text-gray-500">{step.note}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </aside>
  );
}
