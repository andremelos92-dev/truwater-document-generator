"use client";

import { FileDown, Loader2 } from "lucide-react";

import {
  INQUIRY_FIELDS,
  OTHERS,
  autoInquiryValue,
  inquiryFromRfq,
  inquiryInput,
  type InquiryData,
  type InquiryField,
} from "@/lib/inquiry";
import { formatDate, type ProposalData } from "@/lib/proposal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type InquiryFormProps = {
  data: ProposalData;
  onChange: (inquiry: InquiryData) => void;
  onGenerate: () => void;
  generating: boolean;
  error: string | null;
};

// Same spacing as the Commercial Proposal tab.
const CARD = "gap-4 py-4 sm:gap-5 sm:py-5";
const PAD = "px-4 sm:px-6";

/** Rows whose column C note is always offered (not only for "Others"). */
const ALWAYS_NOTE = new Set(["coolingTowerType", "foundationDimensions", "existingDimensions"]);

const number = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 4 });

function Detail({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={cn("truncate text-sm font-medium", value === "—" && "text-muted-foreground font-normal")} title={value}>
        {value}
      </p>
    </div>
  );
}

/** "Inquiry Form" tab: the AE-F03 spreadsheet, filled from the RFQ plus the inquiry's own choices. */
export function InquiryForm({ data, onChange, onGenerate, generating, error }: InquiryFormProps) {
  const rfq = inquiryFromRfq(data);
  const set = (key: keyof InquiryData, value: string) => onChange({ ...data.inquiry, [key]: value });
  const show = (value: string | number | null | undefined) => (value === null || value === undefined || value === "" ? "—" : String(value));

  const field = (f: InquiryField) => {
    const id = `inquiry-${f.key}`;
    const value = inquiryInput(data, f.key);
    const auto = autoInquiryValue(data, f.key);
    const showNote = !!f.noteCell && (ALWAYS_NOTE.has(f.key) || OTHERS.test(value || auto));
    return (
      <div key={f.key} className={cn("grid content-start gap-1.5", f.multiline && "sm:col-span-2")}>
        <Label htmlFor={id} className="leading-snug">
          {f.label}
        </Label>
        {f.options ? (
          <NativeSelect id={id} value={value} onChange={(event) => set(f.key, event.target.value)}>
            {/* Blank: Cooling Tower Type and Structure Material follow the RFQ; others are left empty. */}
            <option value="">{auto ? `From RFQ: ${auto}` : "—"}</option>
            {f.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </NativeSelect>
        ) : f.multiline ? (
          <Textarea id={id} rows={2} value={value} placeholder={f.placeholder} onChange={(event) => set(f.key, event.target.value)} />
        ) : (
          <Input id={id} value={value} placeholder={f.placeholder} onChange={(event) => set(f.key, event.target.value)} />
        )}
        {showNote && (
          <Input
            aria-label={`${f.label} – details`}
            placeholder={f.notePlaceholder ?? "Please specify"}
            value={inquiryInput(data, `${f.key}Note`)}
            onChange={(event) => set(`${f.key}Note`, event.target.value)}
          />
        )}
      </div>
    );
  };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-6" role="tabpanel" aria-label="Inquiry Form">
      <Card className={CARD}>
        <CardHeader className={cn(PAD, "flex flex-wrap items-baseline gap-x-2 gap-y-0.5")}>
          <CardTitle>From the RFQ</CardTitle>
          <CardDescription className="text-xs">Copied from the RFQ &amp; Technical Proposal tab – change it there.</CardDescription>
        </CardHeader>
        <CardContent className={PAD}>
          <div className="bg-muted/40 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border px-3 py-2 lg:grid-cols-6">
            <Detail label="Quote" value={show(data.quoteNumber.trim() && `Quote ${data.quoteNumber.trim()}`)} />
            <Detail label="Date" value={show(formatDate(data.date))} />
            <Detail label="Sales" value={show([data.salesmanName, data.salesmanPhone].filter((v) => v.trim()).join(" "))} className="col-span-2" />
            <Detail label="Email" value={show(data.salesmanEmail.trim())} className="col-span-2" />
            <Detail label="Client Name" value={show(data.customerDetail.trim())} className="col-span-2" />
            <Detail label="Project Name" value={show(data.projectName.trim())} className="col-span-2" />
            <Detail label="Project Location" value={show(data.projectAddress.trim())} className="col-span-2" />
            <Detail
              label="Total Water Flowrate (m3/h)"
              value={rfq.total === null ? "—" : `${number.format(rfq.total)} (${rfq.litres} L/s)`}
              className="col-span-2"
            />
            <Detail label="Flowrate per cell (m3/h)" value={rfq.perCell === null ? "—" : number.format(rfq.perCell)} />
            <Detail label="Number of Cell" value={show(rfq.cells)} />
            <Detail label="Hot Water Temp (℃)" value={show(data.spec.condInTemp.trim())} />
            <Detail label="Cold Water Temp (℃)" value={show(data.spec.condOutTemp.trim())} />
            <Detail label="Wet Bulb Temp (℃)" value={show(data.spec.wetBulbTemp.trim())} />
            <Detail label="Cooling Tower Type" value={show(data.flowType)} />
          </div>
        </CardContent>
      </Card>

      <Card className={CARD}>
        <CardHeader className={PAD}>
          <CardTitle>Inquiry Form</CardTitle>
          <CardDescription>
            Choices from the spreadsheet&apos;s drop-down lists. “Others” opens a box for the details.
          </CardDescription>
        </CardHeader>
        <CardContent className={cn(PAD, "grid gap-4 sm:grid-cols-2")}>
          {INQUIRY_FIELDS.filter((f) => f.section === "inquiry").map(field)}
        </CardContent>
      </Card>

      <Card className={CARD}>
        <CardHeader className={PAD}>
          <CardTitle>Replacement CT Inquiry Form</CardTitle>
          <CardDescription>Only needed if the project is for a replacement cooling tower.</CardDescription>
        </CardHeader>
        <CardContent className={cn(PAD, "grid gap-4 sm:grid-cols-2")}>
          {INQUIRY_FIELDS.filter((f) => f.section === "replacement").map(field)}
        </CardContent>
      </Card>

      {error && <p className="text-destructive text-sm" role="alert">{error}</p>}
      <div className="grid gap-2 sm:flex sm:justify-end sm:gap-3 [&_button]:w-full sm:[&_button]:w-auto">
        <Button type="button" size="lg" disabled={generating} onClick={onGenerate}>
          {generating ? <Loader2 className="animate-spin" /> : <FileDown />}
          Generate Inquiry Form
        </Button>
      </div>
    </div>
  );
}
