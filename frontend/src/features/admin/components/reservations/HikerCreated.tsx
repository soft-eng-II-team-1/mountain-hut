import type {HikerSummary} from "../../../../types";
import Card from "./Card";
import {fullName, primaryButton} from "./ui";

type HikerCreatedProps = {
  hiker: HikerSummary;
  password: string;
  onContinue: () => void;
};

// The generated password is shown only here: the backend does not send it again
export default function HikerCreated({
  hiker,
  password,
  onContinue,
}: HikerCreatedProps) {
  return (
    <Card title="Hiker Profile Created">
      <p className="text-sm">
        <span className="font-semibold">{fullName(hiker)}</span> ({hiker.email})
        has been registered.
      </p>

      <div className="mx-auto mt-6 max-w-md rounded-lg bg-gray-200 px-6 py-4">
        <p className="text-lg font-semibold">
          Generated Password:{" "}
          <span className="select-all font-mono">{password}</span>
        </p>
        <p className="mt-1 text-sm">
          Communicate this password verbally to the hiker. They will be forced
          to change it on their first login.
        </p>
      </div>

      <div className="mt-6 flex justify-center">
        <button type="button" onClick={onContinue} className={primaryButton}>
          Proceed to New Booking
        </button>
      </div>
    </Card>
  );
}
