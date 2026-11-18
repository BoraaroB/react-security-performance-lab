import { Link } from 'react-router';
import { PATHS } from '@/router/paths';

// Shown for every unknown URL. The path is not echoed back (same rule as the API's 404).
export default function NotFoundPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Page not found</h1>
      <p className="text-gray-700">The page you are looking for does not exist.</p>
      <Link to={PATHS.home} className="text-blue-700 underline hover:text-blue-900">
        Go to the home page
      </Link>
    </div>
  );
}
