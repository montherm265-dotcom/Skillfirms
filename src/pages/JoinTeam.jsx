import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, EyeOff, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { inviteInfo, joinTeam } from "@/lib/team";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// Joining a company's training from an invite link, with a clear note on
// what the company will and won't see.
export default function JoinTeam() {
  const { code } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => { inviteInfo(code).then(setInfo); }, [code, user?.id]);

  async function join() {
    if (!user) { navigate(`/auth?mode=signup&next=${encodeURIComponent(`/join/${code}`)}`); return; }
    setBusy(true);
    try {
      await joinTeam(code);
      toast.success(`You've joined ${info.company}'s training`);
      navigate("/my-learning");
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  if (info === undefined) return <div className="section-pad"><div className="mx-auto max-w-md space-y-3"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-40 w-full" /></div></div>;
  if (!info) return <p className="section-pad text-center text-sm text-muted-foreground">This invite link has expired or was replaced. Ask your manager for a new one.</p>;

  return (
    <div className="section-pad">
      <Seo title={`Join ${info.company}'s training`} canonical="/team" />
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 text-center">
        {info.logo_url ? <img src={info.logo_url} alt="" className="mx-auto h-14 w-14 rounded-xl object-cover" /> : <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary font-display text-2xl text-primary-foreground">{info.company.slice(0, 1)}</span>}
        <h1 className="mt-4 text-2xl font-extrabold tracking-[-0.03em]">Join {info.company}'s training</h1>
        <p className="mt-1 text-sm text-muted-foreground">{info.courses ? `${info.courses} course${info.courses === 1 ? "" : "s"} assigned so far.` : "Your manager will assign courses."} It's free for you.</p>
        <ul className="mt-5 space-y-2 text-left text-sm">
          <li className="flex gap-2"><Users className="mt-0.5 h-4 w-4 flex-none text-mastery" /><span>{info.company} will see your progress and certificates <b>in the courses they assign you</b>.</span></li>
          <li className="flex gap-2"><EyeOff className="mt-0.5 h-4 w-4 flex-none text-mastery" /><span>They never see your notes, tutor chats, or any other courses.</span></li>
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-mastery" /><span>You can leave any time from Team training.</span></li>
        </ul>
        {info.member ? (
          <Link to="/my-learning"><Button className="mt-6 w-full">You're in. Go to my courses</Button></Link>
        ) : info.seats_left === 0 ? (
          <p className="mt-6 rounded-lg bg-secondary p-3 text-sm">The team is full right now. Ask your manager to add seats.</p>
        ) : (
          <Button className="mt-6 w-full" onClick={join} disabled={busy}>{!user ? "Sign in to join" : busy ? "Joining…" : `Join ${info.company}`}</Button>
        )}
      </div>
    </div>
  );
}
