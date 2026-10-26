import { useState } from "react";
import EntityCreateModal from "./EntityCreateModal";

type EntityType = "department" | "designation" | "branch";

interface IEntity {
  _id: string;
  name: string;
}

interface EntityPickerProps {
  entity: EntityType;
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: IEntity[];
  onRefresh: () => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  // cascade: naya dept/designation create huda link garne parent
  extraPayload?: Record<string, string | undefined>;
}

const TITLES: Record<EntityType, string> = {
  department: "Department",
  designation: "Designation",
  branch: "Branch",
};

// dropdown ma "+ Add New" - create pachi naya item auto-add huncha
export default function EntityPicker({
  entity,
  label,
  value,
  onChange,
  items,
  onRefresh,
  placeholder = "Select",
  required = false,
  disabled = false,
  extraPayload,
}: EntityPickerProps) {
  const [showModal, setShowModal] = useState(false);

  const ADD_OPTION = `__add_${entity}__`;

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === ADD_OPTION) {
      setShowModal(true);
      return;
    }
    onChange(val);
  };

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <select
          value={value}
          onChange={handleSelectChange}
          required={required}
          disabled={disabled}
          className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white disabled:bg-slate-50 disabled:text-slate-400"
        >
          <option value="">{placeholder}</option>
          {items.map((item) => (
            <option key={item._id} value={item._id}>{item.name}</option>
          ))}
          <option value={ADD_OPTION} className="font-medium text-primary">
            + Add New {TITLES[entity]}
          </option>
        </select>
      </div>

      <EntityCreateModal
        key={`${entity}-${showModal}`}
        entity={entity}
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={(createdId) => {
          if (createdId) onChange(createdId);
          onRefresh();
        }}
        extraPayload={extraPayload}
      />
    </>
  );
}