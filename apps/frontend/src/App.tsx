import { Outlet } from "react-router-dom";
import { Navbar } from "./components/layout/Navbar";
import { ErrorBoundary } from "./components/layout/ErrorBoundary";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
