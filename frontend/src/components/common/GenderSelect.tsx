// gender dropdown - employee create/edit jasto form haru ma reuse garna milne
interface IGenderSelectProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  required?: boolean;
}

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

export default function GenderSelect({
  value,
  onChange,
  label = "Gender",
  className = "",
  required = false,
}: IGenderSelectProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white"
      >
        <option value="">Select</option>
        {GENDER_OPTIONS.map((g) => (
          <option key={g.value} value={g.value}>
            {g.label}
          </option>
        ))}
      </select>
    </div>
  );
}
