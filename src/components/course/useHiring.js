import { useEffect, useState } from "react";
import { loadHiringCourses } from "@/lib/catalog";

// { [courseId]: ["Company", ...] } for courses with a company hiring through them.
export default function useHiring() {
  const [map, setMap] = useState({});
  useEffect(() => {
    let active = true;
    loadHiringCourses().then((m) => { if (active) setMap(m); });
    return () => { active = false; };
  }, []);
  return map;
}
