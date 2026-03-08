import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

function Item({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-2 rounded text-sm ${isActive ? "bg-black text-white" : "hover:bg-gray-100"}`
      }
    >
      {children}
    </NavLink>
  );
}

export function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <div className="border-b">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link to="/" className="font-bold">
          Marketplace
        </Link>

        <div className="flex items-center gap-2">
          <Item to="/">Listings</Item>

          {user && (
            <>
              <Item to="/deals">My deals</Item>
              <Item to="/wallet">Wallet</Item>
              <Item to="/profile">Profile</Item>
              <Item to="/create-listing">Create Listing</Item>
              <Item to="/inbox">Inbox</Item>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!user ? (
            <>
              <Item to="/login">Login</Item>
              <Item to="/register">Register</Item>
            </>
          ) : (
            <>
              <div className="text-xs text-gray-500 hidden sm:block">{user.email}</div>
              <button
                className="px-3 py-2 rounded text-sm border hover:bg-gray-50"
                onClick={() => {
                  logout();
                  nav("/login");
                }}
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
