import { createFileRoute, Link } from "@tanstack/react-router";
import { EtaExplain } from "@/components/rail/EtaExplain";
import { PropagationView } from "@/components/rail/PropagationView";
import { RecommendationQueue } from "@/components/rail/RecommendationQueue";
import { TYPE_LABEL, routeAt, station } from "@/lib/rail/data";
import { TYPE_COLOR, signedMin } from "@/lib/rail/format";
import { useRail, useTrain } from "@/lib/rail/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/trains/$trainId")({
  head: ({ params }) => ({
    meta: [
      { title: `Train ${params.trainId} · ETA explainability — RailPulse AI` },
      {
        name: "description",
        content: `Predicted ETA, feature-level explainability, delay propagation and recommended controller actions for train ${params.trainId}.`,
      },
      { property: "og:title", content: `Train ${params.trainId} — RailPulse AI` },
      {
        property: "og:description",
        content: "Feature-level ETA explainability and cascade forecast for a live service.",
      },
    ],
  }),
  component: TrainDetail,
});

function TrainDetail() {
  const { trainId } = Route.useParams();
  const { train, prediction } = useTrain(trainId);
  const { dispatch, state } = useRail();

  if (!train || !prediction) {
    return (
      <div className="panel-surface rounded-xl p-8 text-center">
        <h1 className="font-display text-lg font-semibold">Service {trainId} not on this corridor</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have terminated or been re-linked to another division.
        </p>
        <Link
          to="/trains"
          className="mt-4 inline-flex rounded-md bg-primary/18 px-4 py-2 text-sm text-primary"
        >
          Back to roster
        </Link>
      </div>
    );
  }

  const origin = station(routeAt(train.route, 0));
  const dest = station(routeAt(train.route, train.route.length - 1));
  const hold = state.holds[train.id] ?? 0;

  return (
    <div className="space-y-4">
      <div className="panel-surface flex flex-wrap items-start justify-between gap-4 rounded-xl px-4 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono-num text-lg text-primary">{train.number}</span>
            <span
              className={cn(
                "rounded border border-current/30 px-2 py-0.5 text-[10px] uppercase tracking-wide",
                TYPE_COLOR[train.type],
              )}
            >
              {TYPE_LABEL[train.type]}
            </span>
            <span className="rounded bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              priority P{train.priority} · {train.status}
              {hold ? ` · hold ${hold.toFixed(0)}m` : ""}
            </span>
          </div>
          <h1 className="mt-1 font-display text-xl font-semibold">{train.name}</h1>
          <p className="mono-num mt-1 text-xs text-muted-foreground">
            {origin.code} {origin.name} → {dest.code} {dest.name} · currently{" "}
            {(train.legProgress * 100).toFixed(0)}% into{" "}
            {routeAt(train.route, train.legIndex)}–{routeAt(train.route, train.legIndex + 1)} at{" "}
            {train.speedKph} km/h · load index {train.load}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: "select", trainId: train.id })}
            className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Focus on map · {signedMin(prediction.predictedDelayMin)}
          </button>
          <Link
            to="/simulator"
            search={{ train: train.number }}
            className="rounded-md bg-primary/18 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/28"
          >
            Run what-if for {train.number}
          </Link>
        </div>
      </div>

      <EtaExplain train={train} prediction={prediction} />
      <PropagationView train={train} />
      <RecommendationQueue compact />
    </div>
  );
}
