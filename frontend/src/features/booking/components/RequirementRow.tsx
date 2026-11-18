import checkBoxIcon from "../../../assets/icons/booking/check-box.svg";
import checkBoxBlankIcon from "../../../assets/icons/booking/check-box-outline-blank.svg";
import trashIcon from "../../../assets/icons/booking/trash.svg";
import type {PartyRequirement} from "../../../types";

export const MAX_DESCRIPTION_LENGTH = 500;

type RequirementRowProps = {
  // 1-based, only used to label the fields for screen readers
  index: number;
  requirement: PartyRequirement;
  // focus the text field when the row has just been added
  autoFocus: boolean;
  error?: string;
  onChange: (requirement: PartyRequirement) => void;
  onRemove: () => void;
};

// MH-05: a requirement of a subset of the party, with its own allergy flag
export default function RequirementRow({
  index,
  requirement,
  autoFocus,
  error,
  onChange,
  onRemove,
}: RequirementRowProps) {
  const errorId = `requirement-${index}-error`;

  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-3 sm:gap-6">
        <input
          type="text"
          value={requirement.description}
          onChange={(e) =>
            onChange({...requirement, description: e.target.value})
          }
          placeholder="E.g.: 1 egg allergy"
          maxLength={MAX_DESCRIPTION_LENGTH}
          autoFocus={autoFocus}
          aria-label={`Requirement ${index} description`}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={`min-w-0 flex-1 rounded-md border bg-[#f8fafc] px-3 py-2 text-sm text-[#23404d] outline-none placeholder:text-black/50 focus:border-[#24414f] ${error ? "border-red-600" : "border-gray-400"}`}
        />

        <label className="flex shrink-0 cursor-pointer items-center gap-1 text-sm text-black">
          <input
            type="checkbox"
            checked={requirement.allergies}
            onChange={(e) =>
              onChange({...requirement, allergies: e.target.checked})
            }
            className="peer sr-only"
          />
          <img
            src={requirement.allergies ? checkBoxIcon : checkBoxBlankIcon}
            alt=""
            aria-hidden="true"
            className="h-8 w-8 rounded-sm peer-focus-visible:outline-2 peer-focus-visible:outline-[#24414f]"
          />
          Allergy
        </label>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove requirement ${index}`}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition hover:bg-gray-200"
        >
          <img src={trashIcon} alt="" aria-hidden="true" className="h-[1.125rem]" />
        </button>
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </li>
  );
}
