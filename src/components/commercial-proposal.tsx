import {
  formatDate,
  projectTitle,
  proposalRecipient,
  referenceNumber,
  resolvedCommercialTowers,
  FLOW_TYPES,
  PORTS,
  PORT_DELIVERY,
  SIGNATORIES,
  type FlowType,
  towerSpecKey,
  towerTotal,
  type CommercialProposalData,
  type CommercialScopeItem,
  type SignatoryId,
  type CommercialTower,
  type ProposalData,
} from "@/lib/proposal";
import { RevisionsEditor } from "@/components/revisions-editor";
import { SaveToHistory } from "@/components/save-to-history";
import { SelectionSummaryButton } from "@/components/selection-summary";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { Eye, FileDown, Loader2, TriangleAlert } from "lucide-react";
import { isMarked, scopeBox, towerBox, type ScanMarks } from "@/lib/scan-marks";
import { useState } from "react";

type CommercialProposalProps = {
  data: ProposalData;
  onChange: (updates: Partial<ProposalData>) => void;
  onGenerate: () => void;
  onPreview: () => void;
  /** Which action is building the document right now, if any. */
  generating: "download" | "preview" | null;
  error: string | null;
  /** Boxes the last document scans didn't fill (marked with *), and clearing them. */
  scanMarks: ScanMarks | null;
  onClearScanMarks: () => void;
};

/**
 * Truwater scope items in the Cooling Tower Bid Form's order (Materials of Construction, then Mechanical
 * Equipment), so they can be checked line by line against it. Only the screen order: the document prints them
 * in their stored order. Items not on the bid form (Mechanical, spares, tools) keep their place after them.
 */
const BID_FORM_SCOPE_ORDER = [
  /^frameworks?$/i, // Framework Members
  /^film fill/i, // Fill Media
  /^drift eliminator/i, // Drift Eliminator
  /^fan cylinder/i, // Fan Cylinder
  /^spray nozzle/i, // Water Distribution System
  /^bolt(?!.*non-wetted).*wetted/i, // Bolts, Nuts & Washers
  /^bolt.*non-wetted/i,
  /^cold water basin support/i, // Cold Water Basin Supporting Framework
  /^mechanical/i,
  /^fan blade/i, // Fan: Blade Material
  /\bphase\b/i, // Motor: Electric Characteristics
  /drive system$/i, // Type of Drive
];

function bidFormScopeOrder(scope: CommercialScopeItem[]) {
  const rank = (item: CommercialScopeItem) => {
    const at = BID_FORM_SCOPE_ORDER.findIndex((match) => match.test(item.description.trim()));
    return at < 0 ? BID_FORM_SCOPE_ORDER.length : at;
  };
  return scope
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.responsibility === "Truwater")
    .sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index);
}

/** Outline for a box a scan didn't fill. */
const MARKED = "border-amber-500 bg-amber-50 ring-2 ring-amber-400/40 dark:bg-amber-500/10";

function ScanStar() {
  return (
    <span className="font-bold text-amber-600 dark:text-amber-400" title="Not filled by the scan – check by hand">
      *
    </span>
  );
}

/**
 * Same order as the equipment table in the Commercial Proposal document. `wide` fields take a full row
 * on phones, which also keeps the half-width ones paired up.
 */
const TOWER_FIELDS: { key: keyof CommercialTower; label: string; placeholder?: string; wide?: boolean }[] = [
  { key: "equipment", label: "Equipment No.", placeholder: "e.g. CT1 & CT2" },
  { key: "model", label: "Cooling Tower Model", placeholder: "e.g. ECF1212F4-1B-1" },
  { key: "cells", label: "No. Of Cells", placeholder: "e.g. 3" },
  { key: "flowType", label: "Type" },
  { key: "arrangement", label: "Arrangement", placeholder: "e.g. In-Line", wide: true },
  { key: "flowRate", label: "Design Flowrate", placeholder: "e.g. 73 (L/s)", wide: true },
  { key: "hotTemperature", label: "Hot (Inlet) Temp", placeholder: "e.g. 35" },
  { key: "coldTemperature", label: "Cold (Outlet) Temp", placeholder: "e.g. 29.5" },
  { key: "wetBulb", label: "Wet Bulb Temp", placeholder: "e.g. 23" },
  { key: "material", label: "Material Of Construction", placeholder: "e.g. SS316" },
  { key: "driveType", label: "Type Of Drive", placeholder: "e.g. Belt", wide: true },
  { key: "motor", label: "Motor kW", placeholder: "e.g. 11", wide: true },
  { key: "infill", label: "Type Of Infill", placeholder: "e.g. PVC Film Fill" },
  { key: "supportBase", label: "Mech. Support Base", placeholder: "Same as material" },
  { key: "basin", label: "Cold Water Basin", placeholder: "Same as material" },
];

// Tighter cards on phones, the usual spacing from sm up.
/** Scope of Supply dropdown entry that opens a box to type any other material. */
const OTHER_MATERIAL = "Other";

const CARD = "gap-4 py-4 sm:gap-5 sm:py-5";
const PAD = "px-4 sm:px-6";

const OTHER_PORT = "__other";

const currency = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
});

export function CommercialProposal({
  data,
  onChange,
  onGenerate,
  onPreview,
  generating,
  error,
  scanMarks,
  onClearScanMarks,
}: CommercialProposalProps) {
  const marked = (key: string) => isMarked(scanMarks, data, key);
  const markedCount = scanMarks ? [...scanMarks.boxes.keys()].filter(marked).length : 0;
  /** Scope rows with "Other" chosen but nothing typed yet (an empty material otherwise means "—"). */
  const [otherScopeRows, setOtherScopeRows] = useState<Set<number>>(() => new Set());
  const title = projectTitle(data) || "Project name from Documents form";
  const recipient = proposalRecipient(data) || "Customer from Documents form";
  const updateCommercial = (commercial: CommercialProposalData) => onChange({ commercial });
  const updateCommercialField = <K extends keyof CommercialProposalData>(
    key: K,
    value: CommercialProposalData[K]
  ) => updateCommercial({ ...data.commercial, [key]: value });
  const towers = resolvedCommercialTowers(data);
  const scopeRows = bidFormScopeOrder(data.commercial.scope);
  const port = towers[0]?.port.trim() ?? "";
  const delivery = PORT_DELIVERY[port];

  // Where a field is filled in on the RFQ / Technical Proposal, if anywhere. Those fields are read-only here.
  const fieldSource = (index: number, key: keyof CommercialTower) => {
    // Tower 1's model and type are the Technical Proposal cover's.
    if (index === 0 && (key === "model" || key === "flowType")) return "Technical Proposal";
    if (!towerSpecKey(key)) return null;
    return index === 0 ? "RFQ" : `Specification ${index + 1}`;
  };

  const setTowerField = (index: number, key: keyof CommercialTower, value: string) => {
    updateCommercialField(
      "towers",
      data.commercial.towers.map((tower, towerIndex) =>
        towerIndex === index ? { ...tower, [key]: value } : tower
      )
    );
  };

  const setScopeField = (index: number, key: "material" | "description" | "responsibility", value: string) =>
    updateCommercialField(
      "scope",
      data.commercial.scope.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    );

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-6" role="tabpanel" aria-label="Commercial Proposal">
      {scanMarks && markedCount > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <TriangleAlert className="size-4 shrink-0" />
          <p className="min-w-0 flex-1">
            <span className="font-semibold">
              {markedCount} {markedCount === 1 ? "box" : "boxes"} not filled by the scan
            </span>{" "}
            of {scanMarks.fileName} — marked <ScanStar /> below. Each mark clears once you change that box.
          </p>
          <Button type="button" variant="outline" size="sm" className="bg-background" onClick={onClearScanMarks}>
            Clear marks
          </Button>
        </div>
      )}
      <Card className={CARD}>
        <CardHeader className={cn(PAD, "flex flex-wrap items-baseline gap-x-2 gap-y-0.5")}>
          <CardTitle>Cover</CardTitle>
          <CardDescription className="text-xs">Copied from the RFQ &amp; Technical Proposal tab.</CardDescription>
        </CardHeader>
        <CardContent className={cn(PAD, "grid gap-3")}>
          <div className="bg-muted/40 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border px-3 py-2 lg:grid-cols-6">
            <Detail label="Project" value={title} className="col-span-2" />
            <Detail label="Client" value={recipient} className="col-span-2" />
            <Detail
              label="Project address"
              value={data.projectAddress || "Project address from Documents form"}
              className="col-span-2"
            />
            <Detail label="TTA quote no." value={data.quoteNumber || "—"} />
            <Detail label="Proposal date" value={formatDate(data.date)} />
            <Detail label="Reference no." value={referenceNumber(data) || "From quote no. and date"} className="col-span-2" />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="grid content-start gap-1">
              <Label htmlFor="commercial-attention" className="text-xs">
                ATTN.{marked("attention") && <ScanStar />}
              </Label>
              <Input
                id="commercial-attention"
                placeholder="e.g. Aaron Hughes & Cale Watson"
                className={cn("h-8 md:text-sm", marked("attention") && MARKED)}
                value={data.commercial.attention}
                onChange={(event) => updateCommercialField("attention", event.target.value)}
              />
            </div>
            {(["signature1", "signature2"] as const).map((key, index) => (
              <div key={key} className="grid content-start gap-1">
                <Label htmlFor={`commercial-${key}`} className="text-xs">Signature {index + 1}</Label>
                <NativeSelect
                  id={`commercial-${key}`}
                  className="h-8 md:text-sm"
                  value={data.commercial[key]}
                  onChange={(event) => updateCommercialField(key, event.target.value as SignatoryId)}
                >
                  {SIGNATORIES.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name} – {person.title}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ))}
          </div>
          <RevisionsEditor
            revisions={data.commercial.revisions}
            onChange={(revisions) => updateCommercialField("revisions", revisions)}
          />
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:gap-4" aria-labelledby="pricing-heading">
        <div className="px-1">
          <h3 id="pricing-heading" className="font-semibold sm:text-lg">Pricing Schedule</h3>
          <p className="text-muted-foreground text-xs sm:text-sm">
            One per tower type. Add tower types with “Add New” on the Cooling Tower Specification.
          </p>
        </div>
        {towers.map((tower, index) => (
          <Card key={index} className={CARD}>
            <CardHeader className={PAD}>
              <CardTitle className="min-w-0 truncate">{tower.equipment || `Cooling tower ${index + 1}`}</CardTitle>
            </CardHeader>
            <CardContent className={cn(PAD, "grid gap-4")}>
              <div className="bg-muted/40 grid grid-cols-2 gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1.5fr)_5rem_minmax(0,1.5fr)_minmax(0,1.2fr)]">
                <div className="col-span-2 grid content-start gap-1.5 sm:col-span-1">
                  <Label htmlFor={`commercial-tower-${index}-price`}>
                    1.1 Material price (AUD){marked(towerBox(index, "price")) && <ScanStar />}
                  </Label>
                  <Input
                    id={`commercial-tower-${index}-price`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 389449"
                    className={cn("bg-background", marked(towerBox(index, "price")) && MARKED)}
                    value={tower.price}
                    onChange={(event) => setTowerField(index, "price", event.target.value)}
                  />
                </div>
                <div className="grid content-start gap-1.5">
                  <Label htmlFor={`commercial-tower-${index}-quantity`}>
                    Qty{marked(towerBox(index, "quantity")) && <ScanStar />}
                  </Label>
                  <Input
                    id={`commercial-tower-${index}-quantity`}
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    className={cn("bg-background", marked(towerBox(index, "quantity")) && MARKED)}
                    value={tower.quantity}
                    onChange={(event) => setTowerField(index, "quantity", event.target.value)}
                  />
                </div>
                <div className="grid content-start gap-1.5">
                  <Label htmlFor={`commercial-tower-${index}-total`}>Total (AUD)</Label>
                  <Input
                    id={`commercial-tower-${index}-total`}
                    readOnly
                    tabIndex={-1}
                    placeholder="Price × qty"
                    className="bg-muted cursor-default font-semibold focus-visible:ring-0"
                    value={tower.price.trim() ? currency.format(Number(towerTotal(tower)) || 0) : ""}
                  />
                </div>
                <div className="col-span-2 grid content-start gap-1.5 sm:col-span-1">
                  <Label htmlFor={`commercial-tower-${index}-port`}>
                    C&amp;F Port{marked(towerBox(index, "port")) && <ScanStar />}
                  </Label>
                  <NativeSelect
                    id={`commercial-tower-${index}-port`}
                    className={cn("bg-background", marked(towerBox(index, "port")) && MARKED)}
                    value={(PORTS as readonly string[]).includes(tower.port) ? tower.port : OTHER_PORT}
                    onChange={(event) =>
                      setTowerField(index, "port", event.target.value === OTHER_PORT ? "" : event.target.value)
                    }
                  >
                    {PORTS.map((port) => (
                      <option key={port} value={port}>
                        {port}
                      </option>
                    ))}
                    <option value={OTHER_PORT}>Other…</option>
                  </NativeSelect>
                  {!(PORTS as readonly string[]).includes(tower.port) && (
                    <Input
                      aria-label="Other port"
                      placeholder="e.g. Newcastle"
                      className="bg-background"
                      value={tower.port}
                      onChange={(event) => setTowerField(index, "port", event.target.value)}
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {TOWER_FIELDS.map(({ key, label, placeholder, wide }) => {
                  const source = fieldSource(index, key);
                  const isMarkedBox = marked(towerBox(index, key));
                  return (
                    <div
                      key={key}
                      className={cn("grid min-w-0 content-end gap-1.5", wide && "col-span-2 lg:col-span-1")}
                    >
                      <Label htmlFor={`commercial-tower-${index}-${key}`} className="text-xs sm:text-sm">
                        {label}
                        {isMarkedBox && <ScanStar />}
                        {source && (
                          <span className="text-primary text-[10px] font-semibold">
                            {key === "model" || key === "flowType" ? "TECH PROP" : index === 0 ? "RFQ" : `SPEC ${index + 1}`}
                          </span>
                        )}
                      </Label>
                      {key === "flowType" && !source ? (
                        <NativeSelect
                          id={`commercial-tower-${index}-${key}`}
                          className={cn(isMarkedBox && MARKED)}
                          value={tower.flowType}
                          onChange={(event) => setTowerField(index, "flowType", event.target.value as FlowType)}
                        >
                          <option value="" disabled>
                            Select…
                          </option>
                          {FLOW_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </NativeSelect>
                      ) : source ? (
                        <Input
                          id={`commercial-tower-${index}-${key}`}
                          readOnly
                          tabIndex={-1}
                          placeholder={`Fill in on ${source === "Technical Proposal" ? "Tech Prop" : source}`}
                          title={`From the ${source} – change it there`}
                          className={cn(
                            "bg-muted cursor-default placeholder:italic focus-visible:ring-0",
                            isMarkedBox && MARKED
                          )}
                          value={tower[key]}
                        />
                      ) : (
                        <Input
                          id={`commercial-tower-${index}-${key}`}
                          placeholder={placeholder}
                          className={cn(isMarkedBox && MARKED)}
                          value={tower[key]}
                          onChange={(event) => setTowerField(index, key, event.target.value)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
        {/* The total lump sum is only printed in the document. */}
      </section>

      <Card className={CARD}>
        <CardHeader className={PAD}>
          <CardTitle>Scope of Supply</CardTitle>
          <CardDescription>
            Items supplied by Truwater, printed as material + description. Optional and By Purchaser items print as
            standard.
          </CardDescription>
        </CardHeader>
        {/* Fills down the left column first, in bid form order, so it reads like the scanned document. */}
        <CardContent
          className={cn(
            PAD,
            "grid gap-x-3 gap-y-1.5 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-[repeat(var(--scope-rows),auto)]"
          )}
          style={{ "--scope-rows": Math.ceil(scopeRows.length / 2) } as React.CSSProperties}
        >
          {/* Material and description are joined into one control. */}
          {scopeRows.map(({ item, index }) =>
            item.responsibility === "Truwater" ? (
              <div
                key={index}
                className={cn(
                  "relative flex min-w-0 rounded-md",
                  marked(scopeBox(index)) && "ring-2 ring-amber-400/70 ring-offset-1"
                )}
              >
                {marked(scopeBox(index)) && (
                  <span className="absolute -top-1.5 -left-1 z-10 leading-none">
                    <ScanStar />
                  </span>
                )}
                {(() => {
                  const material = item.material ?? "";
                  const options = item.materialOptions ?? [];
                  // Rows without a suggested material can also print with none ("—").
                  const noneAllowed = options.length === 0;
                  const other =
                    !options.includes(material) && (material !== "" || !noneAllowed || otherScopeRows.has(index));
                  return (
                    <>
                      {/* Any material that is not one of the options is "Other", typed in the box beside it. */}
                      <div className="shrink-0">
                        <NativeSelect
                          aria-label={`Material for scope item ${index + 1}`}
                          className="bg-muted/50 field-sizing-content h-8 w-auto min-w-[5.25rem] rounded-r-none pr-7 pl-2 font-medium md:text-sm"
                          value={other ? OTHER_MATERIAL : material}
                          onChange={(event) => {
                            const choseOther = event.target.value === OTHER_MATERIAL;
                            setOtherScopeRows((rows) => {
                              const next = new Set(rows);
                              if (choseOther) next.add(index);
                              else next.delete(index);
                              return next;
                            });
                            setScopeField(index, "material", choseOther ? "" : event.target.value);
                            if (choseOther)
                              requestAnimationFrame(() =>
                                document.getElementById(`commercial-scope-${index}-other`)?.focus()
                              );
                          }}
                        >
                          {noneAllowed ? <option value="">—</option> : null}
                          {[...options, OTHER_MATERIAL].map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                      {other ? (
                        <Input
                          id={`commercial-scope-${index}-other`}
                          aria-label={`Other material for scope item ${index + 1}`}
                          placeholder="Type material"
                          className="field-sizing-content -ml-px h-8 w-auto max-w-32 min-w-[6.5rem] shrink-0 rounded-none px-2 font-medium md:text-sm"
                          value={material}
                          onChange={(event) => setScopeField(index, "material", event.target.value)}
                        />
                      ) : null}
                    </>
                  );
                })()}
                <Input
                  aria-label={`Truwater scope item ${index + 1}`}
                  className="-ml-px h-8 min-w-0 flex-1 rounded-l-none px-2 md:text-sm"
                  value={item.description}
                  onChange={(event) => setScopeField(index, "description", event.target.value)}
                />
              </div>
            ) : null
          )}
        </CardContent>
      </Card>
      {/* Optional items (A spare parts, B supervision rates), purchaser responsibilities, the delivery schedule
          chart and the other terms of condition are standard: printed from the defaults, not edited here. */}

      <Card className={CARD}>
        <CardHeader className={PAD}>
          <CardTitle>Delivery &amp; Price Basis</CardTitle>
          <CardDescription>The other terms of condition are standard and print as they are.</CardDescription>
        </CardHeader>
        <CardContent className={cn(PAD, "grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,2fr)]")}>
          <div className="grid content-start gap-1.5">
            <Label htmlFor="commercial-delivery-time">
              Delivery Time{marked("deliveryTime") && <ScanStar />}
            </Label>
            <Input
              id="commercial-delivery-time"
              placeholder="e.g. 14-16 Weeks"
              className={cn(marked("deliveryTime") && MARKED)}
              value={data.commercial.deliveryTime}
              onChange={(event) => updateCommercialField("deliveryTime", event.target.value)}
            />
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor="commercial-containers">
              Containers{marked("containers") && <ScanStar />}
            </Label>
            <Input
              id="commercial-containers"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              className={cn(marked("containers") && MARKED)}
              value={data.commercial.containers}
              onChange={(event) => updateCommercialField("containers", event.target.value)}
            />
          </div>
          <div className="col-span-2 grid content-start gap-1.5 sm:col-span-1">
            <Label htmlFor="commercial-delivery-site">
              Delivered To Site At{marked("deliverySite") && <ScanStar />}
            </Label>
            <Input
              id="commercial-delivery-site"
              placeholder={delivery?.site || data.projectAddress || "Site name"}
              className={cn(marked("deliverySite") && MARKED)}
              value={data.commercial.deliverySite}
              onChange={(event) => updateCommercialField("deliverySite", event.target.value)}
            />
          </div>
          <p className="text-muted-foreground col-span-2 text-xs sm:col-span-3">
            {delivery
              ? `Prints “… from ${port} Port to ${delivery.address} …”. Blank site = ${delivery.site}.`
              : `Prints “… from ${port || "…"} Port …”. Blank site = the project address.`}{" "}
            The port follows tower 1&apos;s C&amp;F port.
          </p>
        </CardContent>
      </Card>

      {error && <p className="text-destructive text-sm" role="alert">{error}</p>}
      <div className="grid gap-2 sm:flex sm:justify-end sm:gap-3 [&_button]:w-full sm:[&_button]:w-auto">
        <SaveToHistory data={data} kinds={["commercial"]} />
        <SelectionSummaryButton data={data} onExtrasChange={(selectionSummary) => onChange({ selectionSummary })} />
        <Button type="button" size="lg" variant="outline" disabled={!!generating} onClick={onPreview}>
          {generating === "preview" ? <Loader2 className="animate-spin" /> : <Eye />}
          Preview
        </Button>
        <Button type="button" size="lg" disabled={!!generating} onClick={onGenerate}>
          {generating === "download" ? <Loader2 className="animate-spin" /> : <FileDown />}
          Generate Commercial Proposal
        </Button>
      </div>
    </div>
  );
}

function Detail({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-muted-foreground text-[11px] font-medium">{label}</p>
      <p className="text-sm leading-snug break-words">{value}</p>
    </div>
  );
}
