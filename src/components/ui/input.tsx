import * as React from "react";

import { cn } from "@/lib/utils";

const formatNumberWithCommas = (value: string): string => {
  // Remove existing commas
  const cleaned = value.replace(/,/g, "");
  // Split by decimal point
  const parts = cleaned.split(".");
  // Format integer part with commas
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
};

const removeCommas = (value: string): string => {
  return value.replace(/,/g, "");
};

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onChange, value, ...props }, ref) => {
    const isNumber = type === "number";
    const [displayValue, setDisplayValue] = React.useState("");

    React.useEffect(() => {
      if (isNumber && value !== undefined && value !== "") {
        setDisplayValue(formatNumberWithCommas(String(value)));
      } else if (value !== undefined) {
        setDisplayValue(String(value));
      }
    }, [value, isNumber]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isNumber) {
        const raw = removeCommas(e.target.value);
        // Allow empty, minus, digits, and one decimal point
        if (raw === "" || raw === "-" || /^-?\d*\.?\d*$/.test(raw)) {
          setDisplayValue(raw === "" || raw === "-" ? raw : formatNumberWithCommas(raw));
          // Create a synthetic event with the raw numeric value
          const syntheticEvent = {
            ...e,
            target: { ...e.target, value: raw },
          } as React.ChangeEvent<HTMLInputElement>;
          onChange?.(syntheticEvent);
        }
        return;
      }
      onChange?.(e);
    };

    if (isNumber) {
      return (
        <input
          type="text"
          inputMode="decimal"
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className,
          )}
          ref={ref}
          value={displayValue}
          onChange={handleChange}
          {...props}
        />
      );
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        value={value}
        onChange={onChange}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
