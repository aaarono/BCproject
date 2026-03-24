import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Outlet } from "react-router-dom";
import { RequireAuth } from "../auth/RequireAuth";
import { RequireAdmin } from "../auth/RequireAdmin";
import App from "../App";
import { LoadingState } from "../components/ui/PageStates";

const ListingsPage = lazy(() =>
  import("../pages/ListingsPage").then((module) => ({ default: module.ListingsPage })),
);
const ListingPage = lazy(() =>
  import("../pages/ListingPage").then((module) => ({ default: module.ListingPage })),
);
const LoginPage = lazy(() =>
  import("../pages/LoginPage").then((module) => ({ default: module.LoginPage })),
);
const RegisterPage = lazy(() =>
  import("../pages/RegisterPage").then((module) => ({ default: module.RegisterPage })),
);
const WalletPage = lazy(() =>
  import("../pages/WalletPage").then((module) => ({ default: module.WalletPage })),
);
const ConversationPage = lazy(() =>
  import("../pages/ConversationPage").then((module) => ({ default: module.ConversationPage })),
);
const DealsPage = lazy(() =>
  import("../pages/DealsPage").then((module) => ({ default: module.DealsPage })),
);
const DealRoomPage = lazy(() =>
  import("../pages/DealRoomPage").then((module) => ({ default: module.DealRoomPage })),
);
const ProfilePage = lazy(() =>
  import("../pages/ProfilePage").then((module) => ({ default: module.ProfilePage })),
);
const MyListingsPage = lazy(() =>
  import("../pages/MyListingsPage").then((module) => ({ default: module.MyListingsPage })),
);
const SettingsPage = lazy(() =>
  import("../pages/SettingsPage").then((module) => ({ default: module.SettingsPage })),
);
const CreateListingPage = lazy(() =>
  import("../pages/CreateListingPage").then((module) => ({ default: module.CreateListingPage })),
);
const InboxPage = lazy(() =>
  import("../pages/InboxPage").then((module) => ({ default: module.InboxPage })),
);
const PublicSellerProfilePage = lazy(() =>
  import("../pages/PublicSellerProfilePage").then((module) => ({ default: module.PublicSellerProfilePage })),
);
const EditListingPage = lazy(() =>
  import("../pages/EditListingPage").then((module) => ({ default: module.EditListingPage })),
);
const NotFoundPage = lazy(() =>
  import("../pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })),
);
const TopSellersPage = lazy(() =>
  import("../pages/TopSellersPage").then((module) => ({ default: module.TopSellersPage })),
);
const AdminPage = lazy(() =>
  import("../pages/AdminPage").then((module) => ({ default: module.AdminPage })),
);

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<LoadingState />}>{element}</Suspense>;
}

export const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { path: "/", element: withSuspense(<ListingsPage />) },
      { path: "/top-sellers", element: withSuspense(<TopSellersPage />) },
      { path: "/listings/:id", element: withSuspense(<ListingPage />) },

      { path: "/login", element: withSuspense(<LoginPage />) },
      { path: "/register", element: withSuspense(<RegisterPage />) },

      {
        element: (
          <RequireAuth>
            <Outlet />
          </RequireAuth>
        ),
        children: [
          { path: "/deals", element: withSuspense(<DealsPage />) },
          { path: "/deals/:id", element: withSuspense(<DealRoomPage />) },
          { path: "/wallet", element: withSuspense(<WalletPage />) },
          { path: "/conversations/:id", element: withSuspense(<ConversationPage />) },
        ],
      },
      {
        path: "/profile",
        element: (
          <RequireAuth>
            {withSuspense(<ProfilePage />)}
          </RequireAuth>
        ),
      },
      {
        path: "/my-listings",
        element: (
          <RequireAuth>
            {withSuspense(<MyListingsPage />)}
          </RequireAuth>
        ),
      },
      {
        path: "/settings",
        element: (
          <RequireAuth>
            {withSuspense(<SettingsPage />)}
          </RequireAuth>
        ),
      },
      {
        path: "/admin",
        element: (
          <RequireAdmin>
            {withSuspense(<AdminPage />)}
          </RequireAdmin>
        ),
      },
      {
        path: "/create-listing",
        element: (
          <RequireAuth>
            {withSuspense(<CreateListingPage />)}
          </RequireAuth>
        ),
      },
      {
        path: "/inbox",
        element: (
          <RequireAuth>
            {withSuspense(<InboxPage />)}
          </RequireAuth>
        ),
      },
      {
        path: "/users/:id",
        element: withSuspense(<PublicSellerProfilePage />),
      },
      {
        path: "/listings/:id/edit",
        element: (
          <RequireAuth>
            {withSuspense(<EditListingPage />)}
          </RequireAuth>
        ),
      },
      { path: "*", element: withSuspense(<NotFoundPage />) },
    ],
  },
]);
