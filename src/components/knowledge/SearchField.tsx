import { IconSearch } from "@tabler/icons-react";

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="hf-directory-filter">
      <IconSearch size={18} className="text-text-secondary" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="hf-type-body w-full bg-transparent outline-none"
      />
    </label>
  );
}
