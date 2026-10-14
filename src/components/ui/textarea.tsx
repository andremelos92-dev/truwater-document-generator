import * as React from "react";

import { correctField } from "@/lib/au-english";
import { cn } from "@/lib/utils";

function Textarea({
  className,
  onBlur,
  autoCorrectAu = true,
  ...props
}: React.ComponentProps<"textarea"> & { autoCorrectAu?: boolean }) {
  const wordy = autoCorrectAu && !props.readOnly;
  return (
    <textarea
      data-slot="textarea"
      spellCheck={wordy ? true : props.spellCheck}
      onBlur={(event) => {
        // A corrected value reaches the form first; whatever runs on leaving the box then sees it.
        if (wordy && correctField(event.currentTarget)) {
          event.persist();
          setTimeout(() => onBlur?.(event), 0);
        } else {
          onBlur?.(event);
        }
      }}
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
