// Shared look of Input, Textarea and Select, so every form control matches.
export const CONTROL_CLASSES = [
  'block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900',
  'placeholder:text-gray-500',
  // `focus:` (not `focus-visible:`): a focused text field should always show the ring, also after a click.
  'focus:outline-2 focus:outline-offset-2 focus:outline-blue-600',
  // The red border follows `aria-invalid`, so the visual state and the screen-reader state cannot disagree.
  'aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:outline-red-600',
  'disabled:cursor-not-allowed disabled:bg-gray-100',
];
