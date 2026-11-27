import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileErrorCounterProps {
  label: string;
  value: number;
  disabled?: boolean;
  min?: number;
  max?: number;
  parseValue?: (rawValue: string) => number;
  onChange: (value: number) => void;
}

export function MobileErrorCounter({
  label,
  value,
  disabled = false,
  min = 0,
  max,
  parseValue,
  onChange,
}: MobileErrorCounterProps) {
  const updateValue = (nextValue: number) => {
    onChange(Math.max(min, nextValue));
  };

  const handleInputChange = (rawValue: string) => {
    const parsedValue = parseValue
      ? parseValue(rawValue)
      : Number.parseInt(rawValue, 10) || 0;
    updateValue(parsedValue);
  };

  return (
    <div className="min-w-0">
      <input
        type="number"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => handleInputChange(event.target.value)}
        className="field-input hidden min-w-0 sm:block"
      />
      <div className="flex items-center gap-1.5 sm:hidden">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Kurangi ${label}`}
          title={`Kurangi ${label}`}
          disabled={disabled || value <= min}
          onClick={() => updateValue(value - 1)}
          className="h-11 w-11 shrink-0 rounded-md"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <input
          type="number"
          min={min}
          max={max}
          step={1}
          inputMode="numeric"
          value={value}
          disabled={disabled}
          aria-label={`${label}, jumlah kesalahan`}
          onChange={(event) => handleInputChange(event.target.value)}
          className="field-input h-11 min-w-0 flex-1 px-2 text-center text-base tabular-nums"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Tambah ${label}`}
          title={`Tambah ${label}`}
          disabled={disabled || (max !== undefined && value >= max)}
          onClick={() => updateValue(value + 1)}
          className="h-11 w-11 shrink-0 rounded-md"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}