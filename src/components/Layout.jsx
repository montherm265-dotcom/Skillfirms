import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, Search, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Logo from "@/components/Logo";
import { openCrossApp } from "@/lib/crossApp";
import { TALFIRMS_URL } from "@/lib/externalLinks";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const navLinkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`;

export default function Layout() {
  const { user, profile, expertId, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [q, setQ] = useState("");
  const [acctOpen, setAcctOpen] = useState(false);
  const location = useLocation();
  const onHome = location.pathname === "/";

  function search(e) {
    e.preventDefault();
    setMobileNavOpen(false);
    navigate(q.trim() ? `/courses?q=${encodeURIComponent(q.trim())}` : "/courses");
  }

  async function handleSignOut() {
    setMobileNavOpen(false);
    await signOut();
    navigate("/");
  }

  const links = [
    { to: "/courses", label: "Courses" },
    { to: "/missions", label: "Missions" },
    { to: "/roles", label: "Careers" },
    ...(user ? [{ to: "/my-learning", label: "My learning" }] : []),
    { to: "/pro", label: "Pro" },
  ];
  const accountLinks = [
    { to: "/dashboard", label: "My goal & path" },
    { to: "/passport", label: "Skill Passport" },
    { to: "/credentials", label: "Certificates" },
    { to: "/team", label: "Team training" },
    ...(expertId ? [{ to: "/teach", label: "Teach: my courses" }, { to: "/expert", label: "Review queue" }] : []),
    { to: "/settings", label: "Settings" },
  ];
  const initial = (profile?.display_name || user?.email || "?").slice(0, 1).toUpperCase();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-8xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
            <span className="font-display text-lg font-semibold tracking-tight">Skillfirms</span>
          </Link>
          {!onHome && (
            <form onSubmit={search} className="mx-4 hidden max-w-xs flex-1 items-center gap-2 rounded-full border border-border bg-secondary/50 px-3.5 py-1.5 focus-within:bg-background focus-within:ring-2 focus-within:ring-ring/20 xl:flex">
              <Search className="h-4 w-4 flex-none text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses" aria-label="Search courses" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            </form>
          )}
          <nav className="hidden items-center gap-1 lg:flex">
            {links.map((l) => <NavLink key={l.to} to={l.to} className={navLinkClass}>{l.label}</NavLink>)}
          </nav>
          <div className="hidden items-center gap-2 lg:flex">
            {user ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => openCrossApp(TALFIRMS_URL, "/matches")}>Talfirms jobs ↗</Button>
                <Popover open={acctOpen} onOpenChange={setAcctOpen}>
                  <PopoverTrigger aria-label="Account menu" className="rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">{initial}</AvatarFallback>
                    </Avatar>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-60 rounded-xl p-1.5">
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-semibold">{profile?.display_name || "Your account"}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="my-1 h-px bg-border" />
                    {accountLinks.map((l) => <Link key={l.to} to={l.to} onClick={() => setAcctOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-secondary">{l.label}</Link>)}
                    <div className="my-1 h-px bg-border" />
                    <button type="button" onClick={() => { setAcctOpen(false); handleSignOut(); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">Sign out</button>
                  </PopoverContent>
                </Popover>
              </>
            ) : (
              <>
                <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
                <Link to="/auth?mode=signup"><Button size="sm">Join free</Button></Link>
              </>
            )}
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground lg:hidden"
            onClick={() => setMobileNavOpen((o) => !o)}
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileNavOpen && (
          <div className="flex flex-col gap-1 border-t border-border px-4 py-3 lg:hidden">
            <form onSubmit={search} className="mb-2 flex items-center gap-2 rounded-full border border-border px-3.5 py-2">
              <Search className="h-4 w-4 flex-none text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses" aria-label="Search courses" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </form>
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={navLinkClass} onClick={() => setMobileNavOpen(false)}>{l.label}</NavLink>
            ))}
            {user ? (
              <>
                {accountLinks.map((l) => <NavLink key={l.to} to={l.to} className={navLinkClass} onClick={() => setMobileNavOpen(false)}>{l.label}</NavLink>)}
                <button type="button" className="rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => { setMobileNavOpen(false); openCrossApp(TALFIRMS_URL, "/matches"); }}>Talfirms jobs ↗</button>
                <button type="button" className="rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground" onClick={handleSignOut}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/auth" className={navLinkClass} onClick={() => setMobileNavOpen(false)}>Sign in</NavLink>
                <NavLink to="/auth?mode=signup" className={navLinkClass} onClick={() => setMobileNavOpen(false)}>Join free</NavLink>
              </>
            )}
          </div>
        )}
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border bg-card/50">
        <div className="mx-auto grid max-w-8xl gap-8 px-4 py-12 text-sm sm:grid-cols-4 sm:px-6 lg:px-8">
          <div>
            <Link to="/" className="flex items-center gap-2"><Logo /><span className="font-display text-lg font-semibold">Skillfirms</span></Link>
            <p className="mt-3 text-xs text-muted-foreground">Learn job skills, prove them, and take the proof to Talfirms.</p>
          </div>
          <div>
            <p className="font-semibold">Learn</p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li><Link to="/courses" className="hover:text-foreground">All courses</Link></li>
              <li><Link to="/missions" className="hover:text-foreground">Missions</Link></li>
              <li><Link to="/roles" className="hover:text-foreground">Career paths</Link></li>
              <li><Link to="/pro" className="hover:text-foreground">Pro</Link></li>
              <li><Link to="/experts" className="hover:text-foreground">Teach or review as an expert</Link></li>
              <li><Link to="/team" className="hover:text-foreground">For teams</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">Prove</p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li><Link to="/credentials" className="hover:text-foreground">My certificates</Link></li>
              <li><Link to="/passport" className="hover:text-foreground">Skill Passport</Link></li>
              <li><a href={TALFIRMS_URL} onClick={(e) => { e.preventDefault(); openCrossApp(TALFIRMS_URL, "/"); }} className="hover:text-foreground">Talfirms ↗</a></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">Skillfirms</p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li><Link to="/privacy" className="hover:text-foreground">Privacy</Link></li>
              <li><Link to="/terms" className="hover:text-foreground">Terms</Link></li>
            </ul>
          </div>
        </div>
        <p className="border-t border-border py-5 text-center text-xs text-muted-foreground">Skillfirms · part of Talfirms</p>
      </footer>
    </div>
  );
}
