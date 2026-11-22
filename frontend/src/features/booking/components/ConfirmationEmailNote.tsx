// shown under the booking cards
export default function ConfirmationEmailNote() {
  return (
    <p className="mt-8 flex items-center justify-center gap-2 text-sm">
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
      A confirmation email will be sent to your address.
    </p>
  );
}
