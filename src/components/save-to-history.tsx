"use client";

import { useState } from "react";
import { Check, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { historyApi } from "@/lib/history-client";
import { historyTitle } from "@/lib/history";
import type { ProposalData } from "@/lib/proposal";

/**
 * Saves the whole form (RFQ, Technical, Commercial and Inquiry) as the project's latest version in History.
 * The project is its TTA quote number, so saving again replaces the earlier save.
 */
export function SaveToHistory({ data }: { data: ProposalData }) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setState("saving");
    setError(null);
    try {
      await historyApi.save(data);
      setState("saved");
      setTimeout(() => setState("idle"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Please try again.");
      setState("idle");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && <span className="text-destructive text-sm">{error}</span>}
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={save}
        disabled={state === "saving"}
        title={`Save "${historyTitle(data)}" to History (replaces its last save)`}
      >
        {state === "saving" ? <Loader2 className="animate-spin" /> : state === "saved" ? <Check /> : <Save />}
        {state === "saved" ? "Saved" : "Save project"}
      </Button>
    </div>
  );
}
