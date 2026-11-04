import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { loadSaved, setSaved } from "@/lib/catalog";

// Saved courses for the signed-in person. onToggle is undefined when the
// feature isn't available, so cards don't show a button that can't work.
export default function useSaved() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState({ ids: new Set(), available: false });
  const userId = user?.id;

  useEffect(() => {
    let active = true;
    if (!userId) { setState({ ids: new Set(), available: true }); return undefined; }
    loadSaved(userId).then((s) => { if (active) setState(s); });
    return () => { active = false; };
  }, [userId]);

  const toggle = useCallback(async (course) => {
    if (!userId) { navigate(`/auth?next=${encodeURIComponent(window.location.pathname)}`); return; }
    const on = !state.ids.has(course.id);
    setState((s) => { const ids = new Set(s.ids); if (on) ids.add(course.id); else ids.delete(course.id); return { ...s, ids }; });
    try {
      await setSaved(userId, course.id, on);
      toast.success(on ? "Saved — find it in My learning" : "Removed from saved");
    } catch {
      setState((s) => { const ids = new Set(s.ids); if (on) ids.delete(course.id); else ids.add(course.id); return { ...s, ids }; });
      toast.error("Couldn't update your saved list");
    }
  }, [navigate, state.ids, userId]);

  return { saved: state.ids, toggle: state.available ? toggle : undefined };
}
