import { Link } from "react-router-dom";
import { Card, CardContent } from "../components/ui/Card";

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-0">
      <Card>
        <CardContent className="space-y-4 py-10 text-center">
          <h1 className="text-6xl font-bold text-muted-foreground/50">404</h1>
          <h2 className="text-xl font-semibold text-foreground">Page not found</h2>
          <p className="text-sm text-muted-foreground">
            The page you are looking for does not exist or has been moved.
          </p>
          <Link
            to="/"
            className="inline-flex rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
          >
            Back to listings
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
