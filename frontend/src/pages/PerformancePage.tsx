import { MemoDemo } from '@/features/performance-demo/MemoDemo';

// Public demos of React rendering performance: what re-renders, and how to skip renders that are not needed.
export default function PerformancePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Performance demos</h1>
      <MemoDemo />
    </div>
  );
}
