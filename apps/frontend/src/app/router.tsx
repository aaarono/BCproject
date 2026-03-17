import { createBrowserRouter, Outlet } from "react-router-dom";
import { RequireAuth } from "../auth/RequireAuth";
import App from "../App";
import { ListingsPage } from "../pages/ListingsPage";
import { ListingPage } from "../pages/ListingPage";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { WalletPage } from "../pages/WalletPage";
import { ConversationPage } from "../pages/ConversationPage";
import { DealsPage } from "../pages/DealsPage";
import { DealRoomPage } from "../pages/DealRoomPage";
import { ProfilePage } from "../pages/ProfilePage";
import { MyListingsPage } from "../pages/MyListingsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { CreateListingPage } from "../pages/CreateListingPage";
import { InboxPage } from "../pages/InboxPage";
import { PublicSellerProfilePage } from "../pages/PublicSellerProfilePage";
import { EditListingPage } from "../pages/EditListingPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { TopSellersPage } from "../pages/TopSellersPage";

export const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { path: "/", element: <ListingsPage /> },
      { path: "/top-sellers", element: <TopSellersPage /> },
      { path: "/listings/:id", element: <ListingPage /> },

      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },

      {
        element: (
          <RequireAuth>
            <Outlet />
          </RequireAuth>
        ),
        children: [
          { path: "/deals", element: <DealsPage /> },
          { path: "/deals/:id", element: <DealRoomPage /> },
          { path: "/wallet", element: <WalletPage /> },
          { path: "/conversations/:id", element: <ConversationPage /> },
        ],
      },
      {
        path: "/profile",
        element: (
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        ),
      },
      {
        path: "/my-listings",
        element: (
          <RequireAuth>
            <MyListingsPage />
          </RequireAuth>
        ),
      },
      {
        path: "/settings",
        element: (
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        ),
      },
      {
        path: "/create-listing",
        element: (
          <RequireAuth>
            <CreateListingPage />
          </RequireAuth>
        ),
      },
      {
        path: "/inbox",
        element: (
          <RequireAuth>
            <InboxPage />
          </RequireAuth>
        ),
      },
      {
        path: "/users/:id",
        element: <PublicSellerProfilePage />,
      },
      {
        path: "/listings/:id/edit",
        element: (
          <RequireAuth>
            <EditListingPage />
          </RequireAuth>
        ),
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
