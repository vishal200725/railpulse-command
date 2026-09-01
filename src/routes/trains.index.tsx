import { createFileRoute } from "@tanstack/react-router";
import { TrainRoster } from "@/components/rail/TrainRoster";
import { RecommendationQueue } from "@/components/rail/RecommendationQueue";

export const Route = createFileRoute("/trains/")({
  head: () => ({
    meta: [
      { title: "Train Control Roster — RailPulse AI" },
      {
        name: "description",
        content:
          "Live roster of every service on the NGP–EST corridor with AI-predicted ETAs, delay risk bands and controller actions.",
      },
      { property: "og:title", content: "Train Control Roster — RailPulse AI" },
      {
        property: "og:description",
        content: "Predicted ETAs, delay risk and precedence actions for every live train.",
      },
    ],
  }),
  component: TrainsPage,
});

function TrainsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold">Train Control</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every service under section control, ranked by predicted delay risk. Select a train for
          full ETA explainability, propagation and recommended interventions.
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <TrainRoster />
        <RecommendationQueue compact />
      </div>
    </div>
  );
}
