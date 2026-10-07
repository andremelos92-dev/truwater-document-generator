"use client";

import { Fragment, useEffect, useState } from "react";
import { Eye, FileDown, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";

import { CommercialProposal } from "@/components/commercial-proposal";
import { DocumentPreview, type PreviewDocument } from "@/components/document-preview";
import { SelectionSummaryButton } from "@/components/selection-summary";
import { RevisionsEditor } from "@/components/revisions-editor";
import { SaveToHistory } from "@/components/save-to-history";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addTowerType,
  createInitialProposal,
  FLOW_TYPES,
  MAX_TOWER_TYPES,
  removeTowerType,
  PARTNERS,
  proposalRecipient,
  referenceNumber,
  SPEC_ROWS,
  type FlowType,
  type ProposalData,
  type Recipient,
  type SpecKey,
} from "@/lib/proposal";
import { LOAD_KEY, restoreProposal } from "@/lib/history";
import { DOCUMENTS, generateDocument, type DocumentKind } from "@/lib/templates";
import { cn } from "@/lib/utils";

type TextField = Exclude<
  keyof ProposalData,
  "spec" | "extraSpecs" | "revisions" | "flowType" | "recipient" | "commercial" | "selectionSummary"
>;

const RECIPIENT_OPTIONS: { value: Recipient; label: string }[] = [
  { value: "customer", label: "Customer" },
  ...PARTNERS.map((partner) => ({ value: partner.id, label: partner.region })),
  { value: "other", label: "Other" },
];

const ASAP = "ASAP";

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const CONTACT_ROWS: {
  label: string;
  fields: { id: TextField; label: string; type?: string }[];
}[] = [
  {
    label: "Contact",
    fields: [
      { id: "contactName", label: "Name" },
      { id: "contactEmail", label: "Email", type: "email" },
      { id: "contactPhone", label: "Phone", type: "tel" },
    ],
  },
  {
    label: "Salesman",
    fields: [
      { id: "salesmanName", label: "Name" },
      { id: "salesmanEmail", label: "Email", type: "email" },
      { id: "salesmanPhone", label: "Phone", type: "tel" },
    ],
  },
];

export function ProposalForm() {
  const [data, setData] = useState<ProposalData>(createInitialProposal);
  const [activeTab, setActiveTab] = useState<"documents" | "commercial">("documents");
  const [generating, setGenerating] = useState<{ kind: DocumentKind; preview: boolean } | null>(null);
  const [preview, setPreview] = useState<PreviewDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  // An entry loaded on the History page arrives here once, then is cleared.
  useEffect(() => {
    // The dashboard links straight to the Commercial tab with ?tab=commercial.
    if (new URLSearchParams(window.location.search).get("tab") === "commercial") setActiveTab("commercial");
    try {
      const stored = sessionStorage.getItem(LOAD_KEY);
      if (!stored) return;
      sessionStorage.removeItem(LOAD_KEY);
      const { kind, data: saved } = JSON.parse(stored);
      setData(restoreProposal(saved));
      if (kind === "commercial") setActiveTab("commercial");
    } catch {
      // Ignore a malformed hand-over; the form simply starts empty.
    }
  }, []);
  const isAsap = data.dateQuoteRequired === ASAP;

  const setField = (field: TextField) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setData((prev) => ({ ...prev, [field]: event.target.value }));

  // Tower type 0 is the RFQ's own specification; 1, 2… are the extra tower types.
  const setSpecAt = (index: number, key: SpecKey, value: string) =>
    setData((prev) =>
      index === 0
        ? { ...prev, spec: { ...prev.spec, [key]: value } }
        : {
            ...prev,
            extraSpecs: prev.extraSpecs.map((spec, i) => (i === index - 1 ? { ...spec, [key]: value } : spec)),
          }
    );

  const field = (
    id: TextField,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
    className?: string
  ) => (
    <div className={cn("grid content-start gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={data[id]} onChange={setField(id)} {...props} />
    </div>
  );

  /** Builds the document, then downloads it or opens it in the preview (which can download it after). */
  async function handleGenerate(kind: DocumentKind, { preview = false } = {}) {
    // The tower type starts blank so it's always chosen on purpose.
    if (kind !== "rfq" && !data.flowType) {
      setError("Select the Tower Type (Counterflow, Crossflow or Closed Circuit) on the RFQ & Technical Proposal tab first.");
      return;
    }
    const untyped = kind === "commercial" ? data.commercial.towers.findIndex((t, i) => i > 0 && !t.flowType) : -1;
    if (untyped > 0) {
      setError(`Select the Type (Counterflow, Crossflow or Closed Circuit) for cooling tower ${untyped + 1}.`);
      return;
    }
    setGenerating({ kind, preview });
    setError(null);
    try {
      const { blob, fileName } = await generateDocument(kind, data);
      const label = kind === "commercial" ? "Commercial Proposal" : DOCUMENTS[kind].label;
      if (preview) setPreview({ label, blob, fileName });
      else downloadBlob(blob, fileName);
    } catch (err) {
      console.error(err);
      setError("Something went wrong while generating the document. Please try again.");
    } finally {
      setGenerating(null);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    await handleGenerate((submitter?.value ?? "rfq") as DocumentKind);
  }

  return (
    <div className="grid gap-6">
      <div className="flex border-b" role="tablist" aria-label="Document sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "documents"}
          onClick={() => setActiveTab("documents")}
          className={cn(
            "min-w-0 flex-1 whitespace-normal border-b-2 px-2 py-3 text-center text-sm font-medium transition-colors sm:px-4",
            activeTab === "documents"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          RFQ &amp; Technical Proposal
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "commercial"}
          onClick={() => setActiveTab("commercial")}
          className={cn(
            "min-w-0 flex-1 whitespace-normal border-b-2 px-2 py-3 text-center text-sm font-medium transition-colors sm:px-4",
            activeTab === "commercial"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Commercial Proposal
        </button>
      </div>

      {activeTab === "commercial" ? (
        <CommercialProposal
          data={data}
          onChange={(updates) => setData((previous) => ({ ...previous, ...updates }))}
          onGenerate={() => void handleGenerate("commercial")}
          onPreview={() => void handleGenerate("commercial", { preview: true })}
          generating={generating?.kind === "commercial" ? (generating.preview ? "preview" : "download") : null}
          error={error}
        />
      ) : (
      <form onSubmit={handleSubmit} className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>Used by both the RFQ and the Technical Proposal.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-12">
            {field(
              "quoteNumber",
              "TTA Quote Number",
              { required: true, placeholder: "TTA0149" },
              "sm:col-span-3"
            )}
            {field(
              "projectName",
              "Project Name",
              { required: true, placeholder: "275 Kent St" },
              "sm:col-span-4"
            )}
            {field(
              "customerDetail",
              "Customer Detail",
              { placeholder: "Climatech NSW Pty Ltd" },
              "sm:col-span-5"
            )}
            {field(
              "projectAddress",
              "Project Address",
              { placeholder: "275 Kent Street, Sydney NSW 2000" },
              "sm:col-span-5"
            )}
            {field("date", "Date", { type: "date" }, "sm:col-span-3")}
            <div className="grid content-start gap-1.5 sm:col-span-4">
              <Label htmlFor="dateQuoteRequired">Date Quote Required</Label>
              <div className="flex gap-2">
                <Input
                  id="dateQuoteRequired"
                  type="date"
                  value={isAsap ? "" : data.dateQuoteRequired}
                  onChange={setField("dateQuoteRequired")}
                  disabled={isAsap}
                />
                <Button
                  type="button"
                  variant={isAsap ? "default" : "outline"}
                  aria-pressed={isAsap}
                  onClick={() =>
                    setData((prev) => ({ ...prev, dateQuoteRequired: isAsap ? "" : ASAP }))
                  }
                >
                  ASAP
                </Button>
              </div>
            </div>
          </div>

          <div className="grid items-center gap-x-3 gap-y-2 border-t pt-5 sm:grid-cols-[5.5rem_1fr_1.3fr_1fr]">
            <span className="text-sm font-semibold">Contacts</span>
            {["Name", "Email", "Phone"].map((heading) => (
              <span key={heading} className="text-muted-foreground hidden text-xs font-medium sm:block">
                {heading}
              </span>
            ))}
            {CONTACT_ROWS.map((row) => (
              <Fragment key={row.label}>
                <Label className="text-muted-foreground mt-2 sm:mt-0">{row.label}</Label>
                {row.fields.map(({ id, label, type }) => (
                  <Input
                    key={id}
                    id={id}
                    type={type}
                    aria-label={`${row.label} ${label.toLowerCase()}`}
                    placeholder={label}
                    value={data[id]}
                    onChange={setField(id)}
                  />
                ))}
              </Fragment>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="gap-4 py-5">
        <CardHeader className="flex items-center gap-2">
          <CardTitle>Message</CardTitle>
          <span className="text-muted-foreground rounded-full border px-2 py-0.5 text-xs font-medium">
            RFQ only
          </span>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-12">
          {field("greeting", "Greeting", {}, "sm:col-span-3")}
          {field("summaryIntro", "Summary", {}, "sm:col-span-4")}
          {field(
            "folderLink",
            "Link To Folder",
            { type: "url", placeholder: "Optional – paste folder link" },
            "sm:col-span-5"
          )}
        </CardContent>
      </Card>

      <Card className="gap-4 py-5">
        <CardHeader className="flex items-center justify-between gap-3">
          <CardTitle>Cooling Tower Specification</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setData((prev) => addTowerType(prev))}
            disabled={data.extraSpecs.length + 1 >= MAX_TOWER_TYPES}
          >
            <Plus /> Add New
          </Button>
        </CardHeader>
        <CardContent className="grid gap-6">
          {[data.spec, ...data.extraSpecs].map((spec, index) => (
            <div key={index} className={cn("grid gap-3", index > 0 && "border-t pt-5")}>
              {data.extraSpecs.length > 0 && (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">
                    Tower Type {index + 1}
                    <span className="text-muted-foreground ml-2 font-normal">
                      {index === 0 ? "used by the RFQ · pricing schedule 1" : `pricing schedule ${index + 1}`}
                    </span>
                  </p>
                  {index > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setData((prev) => removeTowerType(prev, index))}
                    >
                      <Trash2 /> Remove
                    </Button>
                  )}
                </div>
              )}
              {(() => {
                // Printed in this tower type's pricing schedule description ("… Induced Draft, Counterflow, …").
                // Tower type 1 shares it with the Tower Type on the Technical Proposal cover.
                const flowType = index === 0 ? data.flowType : (data.commercial.towers[index]?.flowType ?? "");
                const setFlowType = (value: FlowType) =>
                  setData((prev) =>
                    index === 0
                      ? { ...prev, flowType: value }
                      : {
                          ...prev,
                          commercial: {
                            ...prev.commercial,
                            towers: prev.commercial.towers.map((tower, i) =>
                              i === index ? { ...tower, flowType: value } : tower
                            ),
                          },
                        }
                  );
                return (
                  // The label is as wide as a left-column spec label, so the buttons line up with the fields below;
                  // the buttons then sit side by side across the row.
                  <div className="grid items-center gap-x-3 gap-y-2 sm:grid-cols-[calc((50%_-_1.75rem)*6/11)_minmax(0,1fr)]">
                    <Label className="block leading-snug">
                      Counterflow / Crossflow / Closed Circuit
                      {!flowType && (
                        <span className="text-destructive ml-1.5 text-xs font-normal whitespace-nowrap">Select one</span>
                      )}
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {FLOW_TYPES.map((type) => (
                        <Button
                          key={type}
                          type="button"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          variant={flowType === type ? "default" : "outline"}
                          aria-pressed={flowType === type}
                          onClick={() => setFlowType(type)}
                        >
                          {type}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {/* Fills down the left column first, so the order matches the RFQ table. */}
              <div className="grid gap-x-8 gap-y-2 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-8">
                {SPEC_ROWS.map((row) => {
                  const id = index === 0 ? row.key : `${row.key}-${index + 1}`;
                  return (
                    <div
                      key={row.key}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] items-center gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
                    >
                      <Label htmlFor={id} className="block leading-snug">
                        {row.label}
                        {row.unit && (
                          <span className="text-muted-foreground ml-1.5 text-xs font-normal whitespace-nowrap">
                            {row.unit}
                          </span>
                        )}
                      </Label>
                      <Input
                        id={id}
                        value={spec[row.key]}
                        onChange={(event) => setSpecAt(index, row.key, event.target.value)}
                        placeholder={row.example}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Technical Proposal Cover</CardTitle>
          <CardDescription>
            The cover also uses the quote number and project name above.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-2">
            <Label>Addressed To</Label>
            <div className="flex flex-wrap gap-2">
              {RECIPIENT_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={data.recipient === option.value ? "default" : "outline"}
                  aria-pressed={data.recipient === option.value}
                  onClick={() => setData((prev) => ({ ...prev, recipient: option.value }))}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            {data.recipient === "other" && (
              <Input
                aria-label="Other recipient"
                placeholder="Type the company name for the cover"
                value={data.otherRecipient}
                onChange={setField("otherRecipient")}
                className="sm:max-w-md"
              />
            )}
            <p className="text-muted-foreground text-sm">
              Printed on cover:{" "}
              {proposalRecipient(data) ? (
                <span className="text-foreground font-medium">{proposalRecipient(data)}</span>
              ) : data.recipient === "customer" ? (
                "fill in Customer Detail above"
              ) : (
                "type a company name"
              )}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label>
                Tower Type
                {!data.flowType && <span className="text-destructive text-xs font-normal">Select one</span>}
              </Label>
              <div className="flex flex-wrap gap-2">
                {FLOW_TYPES.map((flowType) => (
                  <Button
                    key={flowType}
                    type="button"
                    className="flex-1"
                    variant={data.flowType === flowType ? "default" : "outline"}
                    aria-pressed={data.flowType === flowType}
                    onClick={() => setData((prev) => ({ ...prev, flowType }))}
                  >
                    {flowType}
                  </Button>
                ))}
              </div>
            </div>
            {field("towerModel", "Model", { placeholder: "ECF1212F4-1B-1" })}
            <div className="grid gap-2">
              <Label>Reference No.</Label>
              <p className="flex h-9 items-center text-sm">
                {referenceNumber(data) ? (
                  <span className="font-medium">{referenceNumber(data)}</span>
                ) : (
                  <span className="text-muted-foreground">Fills in from the TTA Quote Number</span>
                )}
              </p>
            </div>
          </div>

          <RevisionsEditor
            revisions={data.revisions}
            onChange={(revisions) => setData((prev) => ({ ...prev, revisions }))}
          />
        </CardContent>
      </Card>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => setData(createInitialProposal())}>
          <RotateCcw /> Reset
        </Button>
        <SaveToHistory data={data} kinds={["rfq", "proposal"]} />
        <SelectionSummaryButton
          data={data}
          onExtrasChange={(selectionSummary) => setData((prev) => ({ ...prev, selectionSummary }))}
        />
        {(Object.keys(DOCUMENTS) as (keyof typeof DOCUMENTS)[]).map((kind) => (
          <div key={kind} className="flex">
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="rounded-r-none border-r-0 px-3"
              aria-label={`Preview ${DOCUMENTS[kind].label}`}
              title={`Preview ${DOCUMENTS[kind].label}`}
              disabled={!!generating}
              onClick={() => void handleGenerate(kind, { preview: true })}
            >
              {generating?.kind === kind && generating.preview ? <Loader2 className="animate-spin" /> : <Eye />}
            </Button>
            <Button type="submit" value={kind} size="lg" className="rounded-l-none" disabled={!!generating}>
              {generating?.kind === kind && !generating.preview ? <Loader2 className="animate-spin" /> : <FileDown />}
              {DOCUMENTS[kind].label}
            </Button>
          </div>
        ))}
      </div>
      </form>
      )}
      <DocumentPreview
        document={preview}
        onDownload={(doc) => downloadBlob(doc.blob, doc.fileName)}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
