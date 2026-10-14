import * as React from "react";

import { correctField } from "@/lib/au-english";
import { cn } from "@/lib/utils";

/** Text boxes whose words are spell-checked and corrected to Australian English (not emails, numbers, dates…). */
const WORDY = new Set([undefined, "text", "search"]);

function Input({
  className,
  type,
  onBlur,
  autoCorrectAu = true,
  ...props
}: React.ComponentProps<"input"> & { autoCorrectAu?: boolean }) {
  const wordy = autoCorrectAu && WORDY.has(type) && !props.readOnly;
  return (
    <input
      type={type}
      data-slot="input"
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
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  );
}

export { Input };
