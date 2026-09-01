import { createFileRoute } from "@tanstack/react-router";
import { WhatIfSimulator } from "@/components/rail/WhatIfSimulator";

export const Route = createFileRoute("/simulator")({
  validateSearch: (search: Record<string, unknown>): { train?: string } =>
    typeof search["train"] === "string" ? { train: search["train"] } : {},
  head: () => ({
    meta: [
      { title: "What-If Simulation Lab — RailPulse AI" },
      {
        name: "description",
        content:
          "Inject delays, weather, holds and engineering blocks, then compare predicted network delay against the live baseline before committing any controller action.",
      },
      { property: "og:title", content: "What-If Simulation Lab — RailPulse AI" },
      {
        property: "og:description",
        content: "Sandbox controller decisions against the RailPulse ETA engine before you commit.",
      },
    ],
  }),
  component: SimulatorPage,
});

function SimulatorPage() {
  const search = Route.useSearch();
  const initial = search.train;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold">What-If Simulation Lab</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A sandboxed twin of the live corridor. Change one variable and watch the ETA engine
          re-forecast every service, with cascade and passenger exposure quantified before you
          commit.
        </p>
      </div>
      {initial ? <WhatIfSimulator initialTrain={initial} /> : <WhatIfSimulator />}
    </div>
  );
}
