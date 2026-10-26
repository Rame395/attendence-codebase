import BSCalendarInput from "./BSCalendarInput";

interface BSCalendarRangeProps {
  startDate?: Date | null;
  endDate?: Date | null;
  onChange: (start: Date | null, end: Date | null) => void;
  min?: Date | null;
  max?: Date | null;
  className?: string;
  disabled?: boolean;
  startLabel?: string;
  endLabel?: string;
  // false: same-day block; single-day case ma end khali chhodne
  allowSameDay?: boolean;
}

// day compare ko lagi time strip garne
function toDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function shiftDay(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

export default function BSCalendarRange({
  startDate,
  endDate,
  onChange,
  min,
  max,
  className = "",
  disabled,
  startLabel = "Start Date",
  endLabel = "End Date",
  allowSameDay = true,
}: BSCalendarRangeProps) {
  // strict mode: end = start+1 dekhi, start = end-1 samma matra
  const endMin = !allowSameDay && startDate ? shiftDay(toDay(startDate), 1) : startDate || min;
  const startMax = !allowSameDay && endDate ? shiftDay(toDay(endDate), -1) : max || endDate || undefined;

  const handleStartChange = (d: Date | null) => {
    if (!allowSameDay && d && endDate && toDay(endDate).getTime() <= toDay(d).getTime()) {
      // end start bhanda aghi / same bhayo - clear garne (user le feri pick garxa)
      onChange(d, null);
      return;
    }
    onChange(d, endDate ?? null);
  };

  const handleEndChange = (d: Date | null) => {
    if (!allowSameDay && d && startDate && toDay(d).getTime() <= toDay(startDate).getTime()) {
      // same/earlier end pick garna didaina
      return;
    }
    onChange(startDate ?? null, d);
  };

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${className}`}>
      <BSCalendarInput
        value={startDate ?? null}
        onChange={handleStartChange}
        min={min}
        max={startMax}
        label={startLabel}
        placeholder="Select start / single date"
        disabled={disabled}
      />
      <BSCalendarInput
        value={endDate ?? null}
        onChange={handleEndChange}
        min={endMin}
        max={max}
        label={endLabel}
        placeholder={endLabel}
        disabled={disabled}
      />
    </div>
  );
}
