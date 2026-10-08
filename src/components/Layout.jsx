import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Layout() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-8xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
            <span className="font-display text-lg font-semibold tracking-tight">Skillfirms</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground sm:flex">
            <Link to="/roles" className="hover:text-foreground">Career roles</Link>
            <Link to="/missions" className="hover:text-foreground">Missions</Link>
            {user && <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>}
            {user && <Link to="/passport" className="hover:text-foreground">Skill Passport</Link>}
            {user && <Link to="/credentials" className="hover:text-foreground">Credentials</Link>}
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link to="/dashboard">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{(profile?.display_name || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>Sign out</Button>
              </>
            ) : (
              <>
                <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
                <Link to="/auth?mode=signup"><Button size="sm">Build my path</Button></Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Skillfirms — Powered by Talfirms
      </footer>
    </div>
  );
}
