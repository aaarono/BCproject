import { Link } from "react-router-dom";
import { Card, CardContent } from "../components/ui/Card";

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-0">
      <Card>
        <CardContent className="space-y-4 py-10 text-center">
          <h1 className="text-6xl font-bold text-slate-300">404</h1>
          <h2 className="text-xl font-semibold text-slate-900">Page not found</h2>
          <p className="text-sm text-slate-600">
            The page you are looking for does not exist or has been moved.
          </p>
          <Link
            to="/"
            className="inline-flex rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Back to listings
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
