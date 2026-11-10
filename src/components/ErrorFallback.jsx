import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function ErrorFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[radial-gradient(80%_60%_at_50%_0%,#eef1ff,transparent)] p-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1f4189]/10 text-[#1f4189]"><AlertTriangle className="h-8 w-8" /></span>
      <h1 className="text-3xl font-extrabold tracking-tight">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">We've logged the error. Try reloading the page. If it keeps happening, let us know.</p>
      <Button onClick={() => window.location.reload()} className="rounded-full px-6">Try again</Button>
    </div>
  );
}
