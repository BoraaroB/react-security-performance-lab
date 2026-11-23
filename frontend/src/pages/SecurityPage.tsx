import { XssDemo } from '@/features/security-demo/XssDemo';

// Public demos of the browser-side security topics. Steps 23b–23d add more sections.
export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Security demos</h1>
      <XssDemo />
    </div>
  );
}
