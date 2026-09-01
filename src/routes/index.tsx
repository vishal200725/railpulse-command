import { createFileRoute } from "@tanstack/react-router";
import { EventStream } from "@/components/rail/EventStream";
import { KpiStrip } from "@/components/rail/KpiStrip";
import { NetworkMap } from "@/components/rail/NetworkMap";
import { RecommendationQueue } from "@/components/rail/RecommendationQueue";
import { TrainRoster } from "@/components/rail/TrainRoster";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RailPulse AI — Railway Traffic Command Center" },
      {
        name: "description",
        content:
          "Live digital-twin command center for railway traffic control: AI ETA prediction, delay propagation, conflict recommendations and what-if simulation.",
      },
      { property: "og:title", content: "RailPulse AI — Railway Traffic Command Center" },
      {
        property: "og:description",
        content:
          "AI-assisted railway control: predicted ETAs, cascade forecasting and precedence recommendations on a live corridor twin.",
      },
    ],
  }),
  component: CommandCenter,
});

function CommandCenter() {
  return (
    <div className="space-y-4">
      <KpiStrip />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <NetworkMap />
        <RecommendationQueue />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <TrainRoster limit={8} />
        <EventStream height="max-h-[420px]" />
      </div>
    </div>
  );
}
