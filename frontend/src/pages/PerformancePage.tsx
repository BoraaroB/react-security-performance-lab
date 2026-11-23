import { DeferredDemo } from '@/features/performance-demo/DeferredDemo';
import { DynamicImportDemo } from '@/features/performance-demo/DynamicImportDemo';
import { IntervalLeakDemo } from '@/features/performance-demo/IntervalLeakDemo';
import { MemoDemo } from '@/features/performance-demo/MemoDemo';
import { VirtualListDemo } from '@/features/performance-demo/VirtualListDemo';

// Public demos of React rendering performance (what re-renders, how to skip renders that are not needed) and of
// loading code only when it is needed, and of memory leaks (work that outlives its component).
export default function PerformancePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Performance demos</h1>
      <MemoDemo />
      <DeferredDemo />
      <VirtualListDemo />
      <DynamicImportDemo />
      <IntervalLeakDemo />
    </div>
  );
}
