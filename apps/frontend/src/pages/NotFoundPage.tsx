import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="max-w-md mx-auto p-10 text-center">
      <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
      <h2 className="text-xl font-semibold mb-2">Page not found</h2>
      <p className="text-gray-600 mb-6">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link to="/" className="px-4 py-2 border rounded hover:bg-gray-50 text-sm">
        Back to listings
      </Link>
    </div>
  );
}
