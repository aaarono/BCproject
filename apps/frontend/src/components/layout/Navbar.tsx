import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import {
  Menu,
  X,
  ShoppingBag,
  Trophy,
  Handshake,
  Gamepad2,
  Plus,
  Mail,
  User,
  Settings,
  LogIn,
  UserPlus,
  LogOut,
  Shield,
} from "lucide-react";
import { Button } from "../ui/Button";
import { http } from "../../api/http";
import { getSocket } from "../../api/socket";
import { Badge } from "../ui/Badge";
import { Avatar } from "../ui/Avatar";
import { formatUsdFromCents } from "../../lib/currency";

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
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [inboxCount, setInboxCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const refreshWalletBalance = useCallback(async () => {
    if (!user) return;

    const walletResult = await http.get<{ userId: string; balance: number }>("/wallet/me");
    setWalletBalance(walletResult.data.balance);
  }, [user]);

  const refreshInboxCount = useCallback(async () => {
    if (!user) return;

    const conversationsResult = await http.get<Array<{ id: string; unreadCount?: number }>>("/conversations/me");
    const unreadTotal = conversationsResult.data.reduce(
      (sum, conversation) => sum + (conversation.unreadCount ?? 0),
      0,
    );
    setInboxCount(unreadTotal);
  }, [user]);

  const refreshHeaderStats = useCallback(async () => {
    await Promise.allSettled([refreshWalletBalance(), refreshInboxCount()]);
  }, [refreshInboxCount, refreshWalletBalance]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void refreshHeaderStats();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [refreshHeaderStats, user?.id]);

  useEffect(() => {
    const socket = getSocket();
    const refreshWallet = () => {
      void refreshWalletBalance().catch(() => {});
    };
    const refreshInbox = () => {
      void refreshInboxCount().catch(() => {});
    };

    socket.on("inbox:update", refreshInbox);
    socket.on("deal:update", refreshWallet);
    return () => {
      socket.off("inbox:update", refreshInbox);
      socket.off("deal:update", refreshWallet);
    };
  }, [refreshInboxCount, refreshWalletBalance, user]);

  useEffect(() => {
    const handleInboxRead = () => {
      void refreshInboxCount().catch(() => {});
    };

    window.addEventListener("inbox:read", handleInboxRead);

    return () => {
      window.removeEventListener("inbox:read", handleInboxRead);
    };
  }, [refreshInboxCount]);

  const closeMobile = () => setMobileOpen(false);

  const activeDesktopClass =
    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition bg-accent text-accent-foreground";
  const idleDesktopClass =
    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground";

  const initials = (user?.displayName ?? user?.email ?? "U").slice(0, 2).toUpperCase();
  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "User";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2" onClick={closeMobile}>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Gamepad2 className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">TradeGame</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/" className={({ isActive }) => (isActive ? activeDesktopClass : idleDesktopClass)}>
            <ShoppingBag className="h-4 w-4" />
            Listings
          </NavLink>
          <NavLink
            to="/top-sellers"
            className={({ isActive }) => (isActive ? activeDesktopClass : idleDesktopClass)}
          >
            <Trophy className="h-4 w-4" />
            Top Sellers
          </NavLink>
          {user && (
            <NavLink
              to="/deals"
              className={({ isActive }) => (isActive ? activeDesktopClass : idleDesktopClass)}
            >
              <Handshake className="h-4 w-4" />
              Deals
            </NavLink>
          )}
          {user?.role === "ADMIN" && (
            <NavLink
              to="/admin"
              className={({ isActive }) => (isActive ? activeDesktopClass : idleDesktopClass)}
            >
              <Shield className="h-4 w-4" />
              Admin
            </NavLink>
          )}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user && (
            <>
              <Link
                to="/wallet"
                className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
              >
                {walletBalance !== null ? formatUsdFromCents(walletBalance) : "..."}
              </Link>

              <Button asChild size="sm">
                <Link to="/create-listing">
                  <Plus className="h-4 w-4" />
                  Create Listing
                </Link>
              </Button>

              <Link
                to="/inbox"
                className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-accent ${
                  location.pathname === "/inbox" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                }`}
              >
                <Mail className="h-5 w-5" />
                {inboxCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sale px-1 text-[10px] font-medium text-sale-foreground">
                    {inboxCount > 9 ? "9+" : inboxCount}
                  </span>
                )}
              </Link>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent"
                >
                  <Avatar
                    src={user?.avatarUrl}
                    alt={displayName}
                    fallback={initials}
                    className="h-7 w-7"
                    fallbackClassName="text-xs font-semibold"
                  />
                  <span className="max-w-[110px] truncate text-sm font-medium text-foreground">{displayName}</span>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-border bg-card p-1 shadow-lg">
                    <Link to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent">
                      <User className="h-4 w-4" />
                      Profile
                    </Link>
                    <Link to="/my-listings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent">
                      <ShoppingBag className="h-4 w-4" />
                      My Listings
                    </Link>
                    <Link to="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                    {user?.role === "ADMIN" && (
                      <Link to="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent">
                        <Shield className="h-4 w-4" />
                        Admin
                      </Link>
                    )}
                    <div className="my-1 h-px bg-border" />
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        logout().then(() => nav("/login"));
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {!user && (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">
                  <LogIn className="h-4 w-4" />
                  Login
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/register">
                  <UserPlus className="h-4 w-4" />
                  Register
                </Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-accent md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
          type="button"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-border bg-card md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
            <Item to="/" onClick={closeMobile} icon={<ShoppingBag className="h-4 w-4" />}>Listings</Item>
            <Item to="/top-sellers" onClick={closeMobile} icon={<Trophy className="h-4 w-4" />}>Top Sellers</Item>

            {user && (
              <>
                <Item to="/deals" onClick={closeMobile} icon={<Handshake className="h-4 w-4" />}>Deals</Item>
                <Item to="/wallet" onClick={closeMobile} icon={<ShoppingBag className="h-4 w-4" />}>Wallet</Item>
                <Item to="/create-listing" onClick={closeMobile} icon={<Plus className="h-4 w-4" />}>Create Listing</Item>
                {user.role === "ADMIN" && (
                  <Item to="/admin" onClick={closeMobile} icon={<Shield className="h-4 w-4" />}>Admin</Item>
                )}
                <NavLink
                  to="/inbox"
                  onClick={closeMobile}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`
                  }
                >
                  <Mail className="h-4 w-4" />
                  Inbox
                  {inboxCount > 0 && <Badge className="ml-auto bg-sale text-sale-foreground">{inboxCount}</Badge>}
                </NavLink>
                <Item to="/profile" onClick={closeMobile} icon={<User className="h-4 w-4" />}>Profile</Item>
                <Item to="/settings" onClick={closeMobile} icon={<Settings className="h-4 w-4" />}>Settings</Item>
              </>
            )}

            {!user ? (
              <>
                <Item to="/login" onClick={closeMobile} icon={<LogIn className="h-4 w-4" />}>Login</Item>
                <NavLink
                  to="/register"
                  onClick={closeMobile}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                >
                  <UserPlus className="h-4 w-4" />
                  Register
                </NavLink>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-input px-3 py-2 text-xs text-muted-foreground">
                  {user.email}
                </div>
                <button
                  className="rounded-lg border border-input px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                  onClick={async () => {
                    await logout();
                    closeMobile();
                    nav("/login");
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <LogOut className="h-4 w-4" />
                    Logout
                  </span>
                </button>
              </>
            )}

          </div>
        </div>
      )}
    </header>
  );
}
