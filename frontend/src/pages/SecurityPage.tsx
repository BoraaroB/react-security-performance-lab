import { CsrfDemo } from '@/features/security-demo/CsrfDemo';
import { RateLimitDemo } from '@/features/security-demo/RateLimitDemo';
import { UrlDemo } from '@/features/security-demo/UrlDemo';
import { XssDemo } from '@/features/security-demo/XssDemo';

// Public demos of the browser-side security topics. Step 23d adds the CSP.
export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Security demos</h1>
      <XssDemo />
      <UrlDemo />
      <CsrfDemo />
      <RateLimitDemo />
    </div>
  );
}
