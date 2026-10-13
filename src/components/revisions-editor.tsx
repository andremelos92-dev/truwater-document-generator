"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { createRevision, MAX_REVISIONS, REVISION_PEOPLE, REVISION_STATUSES, type Revision } from "@/lib/proposal";
import { cn } from "@/lib/utils";

/** Columns chosen from a list: the status and the sign-offs. */
const COLUMN_OPTIONS = { status: REVISION_STATUSES, ...REVISION_PEOPLE };

type ListColumn = keyof typeof COLUMN_OPTIONS;

function isListColumn(key: keyof Revision): key is ListColumn {
  return key in COLUMN_OPTIONS;
}

/** The choices offered for a column, keeping any other value already entered. */
function columnOptions(column: ListColumn, current: string): readonly string[] {
  const choices: readonly string[] = COLUMN_OPTIONS[column];
  return current && !choices.includes(current) ? [...choices, current] : choices;
}

const REVISION_FIELDS: { key: keyof Revision; label: string; type?: string; width?: string }[] = [
  { key: "rev", label: "Rev.", width: "w-12" },
  { key: "date", label: "Date", type: "date", width: "w-36" },
  { key: "status", label: "Status", width: "w-32" },
  { key: "preparedBy", label: "Prepared By", width: "w-32" },
  { key: "checkedBy", label: "Checked By", width: "w-32" },
  { key: "approvedBy", label: "Approved By", width: "w-32" },
  { key: "remarks", label: "Remarks" },
];

/** The revision table shown on a document cover (Rev., Date, Status, sign-offs, Remarks). */
export function RevisionsEditor({
  revisions,
  onChange,
}: {
  revisions: Revision[];
  onChange: (revisions: Revision[]) => void;
}) {
  const setValue = (index: number, key: keyof Revision, value: string) =>
    onChange(revisions.map((revision, i) => (i === index ? { ...revision, [key]: value } : revision)));

  const renderField = (revision: Revision, index: number, column: (typeof REVISION_FIELDS)[number], id?: string) =>
    isListColumn(column.key) ? (
      <NativeSelect
        id={id}
        aria-label={`${column.label} (row ${index + 1})`}
        className="h-8 md:text-sm"
        value={revision[column.key]}
        onChange={(event) => setValue(index, column.key, event.target.value)}
      >
        <option value="">–</option>
        {columnOptions(column.key, revision[column.key]).map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </NativeSelect>
    ) : (
      <Input
        id={id}
        aria-label={`${column.label} (row ${index + 1})`}
        className="h-8 md:text-sm"
        type={column.type}
        value={revision[column.key]}
        onChange={(event) => setValue(index, column.key, event.target.value)}
      />
    );

  const removeButton = (revision: Revision, index: number) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8"
      aria-label={`Remove revision ${revision.rev || index + 1}`}
      onClick={() => onChange(revisions.filter((_, i) => i !== index))}
    >
      <Trash2 />
    </Button>
  );

  return (
    <div className="grid gap-2">
      <Label className="text-xs">Revisions</Label>
      {/* Phones: one compact block per revision instead of the wide table. */}
      <div className="grid gap-2 sm:hidden">
        {revisions.map((revision, index) => (
          <div key={index} className="grid grid-cols-2 gap-1.5 rounded-lg border p-2">
            {REVISION_FIELDS.map((column) => (
              <div
                key={column.key}
                className={cn("grid min-w-0 gap-1", column.key === "remarks" && "col-span-2")}
              >
                <span className="text-muted-foreground text-xs font-medium">{column.label}</span>
                {renderField(revision, index, column)}
              </div>
            ))}
            <div className="col-span-2 -mb-1 flex justify-end">{removeButton(revision, index)}</div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-x-1 border-spacing-y-0.5 text-sm">
          <thead>
            <tr className="text-muted-foreground text-left text-xs">
              {REVISION_FIELDS.map((column) => (
                <th key={column.key} className={cn("font-medium", column.width)}>
                  {column.label}
                </th>
              ))}
              <th className="w-8">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {revisions.map((revision, index) => (
              <tr key={index}>
                {REVISION_FIELDS.map((column) => (
                  <td key={column.key}>{renderField(revision, index, column)}</td>
                ))}
                <td>{removeButton(revision, index)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onChange([...revisions, createRevision(String(revisions.length))])}
          disabled={revisions.length >= MAX_REVISIONS}
        >
          <Plus /> Add Revision
        </Button>
        <span className="text-muted-foreground text-xs">
          Up to {MAX_REVISIONS} revisions fit in the table.
        </span>
      </div>
    </div>
  );
}
