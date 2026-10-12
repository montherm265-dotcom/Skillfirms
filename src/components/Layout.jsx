import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navLinkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`;

export default function Layout() {
  const { user, profile, expertId, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  async function handleSignOut() {
    setMobileNavOpen(false);
    await signOut();
    navigate("/");
  }

  const links = [
    { to: "/roles", label: "Career roles" },
    { to: "/missions", label: "Missions" },
    ...(user ? [{ to: "/dashboard", label: "Dashboard" }] : []),
    ...(user ? [{ to: "/passport", label: "Skill Passport" }] : []),
    ...(user ? [{ to: "/credentials", label: "Credentials" }] : []),
    ...(expertId ? [{ to: "/expert", label: "Review queue" }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-8xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
            <span className="font-display text-lg font-semibold tracking-tight">Skillfirms</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map((l) => <NavLink key={l.to} to={l.to} className={navLinkClass}>{l.label}</NavLink>)}
          </nav>
          <div className="hidden items-center gap-2 sm:flex">
            {user ? (
              <>
                <Link to="/dashboard">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{(profile?.display_name || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Link>
                <Link to="/settings"><Button variant="ghost" size="sm">Settings</Button></Link>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>Sign out</Button>
              </>
            ) : (
              <>
                <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
                <Link to="/auth?mode=signup"><Button size="sm">Build my path</Button></Link>
              </>
            )}
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground sm:hidden"
            onClick={() => setMobileNavOpen((o) => !o)}
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileNavOpen && (
          <div className="flex flex-col gap-1 border-t border-border px-4 py-3 sm:hidden">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={navLinkClass} onClick={() => setMobileNavOpen(false)}>{l.label}</NavLink>
            ))}
            {user ? (
              <>
                <NavLink to="/settings" className={navLinkClass} onClick={() => setMobileNavOpen(false)}>Settings</NavLink>
                <button type="button" className="rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground" onClick={handleSignOut}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/auth" className={navLinkClass} onClick={() => setMobileNavOpen(false)}>Sign in</NavLink>
                <NavLink to="/auth?mode=signup" className={navLinkClass} onClick={() => setMobileNavOpen(false)}>Build my path</NavLink>
              </>
            )}
          </div>
        )}
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <p>Skillfirms — Powered by Talfirms</p>
        <div className="mt-2 flex justify-center gap-4">
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
        </div>
      </footer>
    </div>
  );
}
