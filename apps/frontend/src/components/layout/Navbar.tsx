import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import {
  ShoppingBag,
  Trophy,
  Handshake,
  Wallet,
  Plus,
  Mail,
  User,
  Settings,
} from "lucide-react";
import { Button } from "../ui/Button";

function Item({
  to,
  children,
  onClick,
  icon,
}: {
  to: string;
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
          isActive
            ? "bg-slate-900 text-white"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`
      }
    >
      {icon}
      {children}
    </NavLink>
  );
}

export function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2" onClick={closeMobile}>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
            TG
          </span>
          <span className="text-base font-semibold tracking-tight">TradeGame</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Item to="/" icon={<ShoppingBag className="h-4 w-4" />}>Listings</Item>
          <Item to="/top-sellers" icon={<Trophy className="h-4 w-4" />}>Top Sellers</Item>

          {user && <Item to="/deals" icon={<Handshake className="h-4 w-4" />}>Deals</Item>}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user && (
            <>
              <Item to="/wallet" icon={<Wallet className="h-4 w-4" />}>Wallet</Item>
              <Item to="/create-listing" icon={<Plus className="h-4 w-4" />}>Create</Item>
              <Item to="/inbox" icon={<Mail className="h-4 w-4" />}>Inbox</Item>
              <Item to="/profile" icon={<User className="h-4 w-4" />}>Profile</Item>
              <Item to="/settings" icon={<Settings className="h-4 w-4" />}>Settings</Item>
            </>
          )}

          {!user ? (
            <>
              <Item to="/login">Login</Item>
              <Item to="/register">Register</Item>
            </>
          ) : (
            <>
              <div className="max-w-[180px] truncate text-xs text-slate-500">{user.email}</div>
              <button
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
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

        <Button
          variant="outline"
          size="sm"
          className="md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? "Close" : "Menu"}
        </Button>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:px-6">
            <Item to="/" onClick={closeMobile} icon={<ShoppingBag className="h-4 w-4" />}>Listings</Item>
            <Item to="/top-sellers" onClick={closeMobile} icon={<Trophy className="h-4 w-4" />}>Top Sellers</Item>

            {user && (
              <>
                <Item to="/deals" onClick={closeMobile} icon={<Handshake className="h-4 w-4" />}>Deals</Item>
                <Item to="/wallet" onClick={closeMobile} icon={<Wallet className="h-4 w-4" />}>Wallet</Item>
                <Item to="/create-listing" onClick={closeMobile} icon={<Plus className="h-4 w-4" />}>Create Listing</Item>
                <Item to="/inbox" onClick={closeMobile} icon={<Mail className="h-4 w-4" />}>Inbox</Item>
                <Item to="/profile" onClick={closeMobile} icon={<User className="h-4 w-4" />}>Profile</Item>
                <Item to="/settings" onClick={closeMobile} icon={<Settings className="h-4 w-4" />}>Settings</Item>
              </>
            )}

            {!user ? (
              <>
                <Item to="/login" onClick={closeMobile}>Login</Item>
                <Item to="/register" onClick={closeMobile}>Register</Item>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500">
                  {user.email}
                </div>
                <button
                  className="rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-medium text-slate-700"
                  onClick={() => {
                    logout();
                    closeMobile();
                    nav("/login");
                  }}
                >
                  Logout
                </button>
              </>
            )}

          </div>
        </div>
      )}
    </header>
  );
}
