"use client";

import { useState } from "react";
import { Check, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { HISTORY_KINDS, type HistoryKind } from "@/lib/history";
import { historyApi } from "@/lib/history-client";
import type { ProposalData } from "@/lib/proposal";

// Saving to History is switched off while the tool is being tested; set to true to turn it back on.
const SAVING_ENABLED = false;

type SaveToHistoryProps = { data: ProposalData; kinds: HistoryKind[] };

export function SaveToHistory(props: SaveToHistoryProps) {
  if (SAVING_ENABLED) return <SaveToHistoryControls {...props} />;
  return (
    <Button type="button" variant="outline" size="lg" disabled title="Saving to History is coming soon">
      <Save /> Save · Coming soon
    </Button>
  );
}

/** Saves the whole form to History under one of the given tabs. */
function SaveToHistoryControls({ data, kinds }: SaveToHistoryProps) {
  const [kind, setKind] = useState<HistoryKind>(kinds[0]);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setState("saving");
    setError(null);
    try {
      await historyApi.save(kind, data);
      setState("saved");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setError("Could not save. Please try again.");
      setState("idle");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && <span className="text-destructive text-sm">{error}</span>}
      {kinds.length > 1 && (
        <NativeSelect
          aria-label="Save as"
          value={kind}
          onChange={(event) => setKind(event.target.value as HistoryKind)}
          className="h-10 w-auto"
        >
          {kinds.map((id) => (
            <option key={id} value={id}>
              Save as {HISTORY_KINDS.find((k) => k.id === id)?.label}
            </option>
          ))}
        </NativeSelect>
      )}
      <Button type="button" variant="outline" size="lg" onClick={save} disabled={state === "saving"}>
        {state === "saving" ? <Loader2 className="animate-spin" /> : state === "saved" ? <Check /> : <Save />}
        {state === "saved" ? "Saved" : "Save"}
      </Button>
    </div>
  );
}
