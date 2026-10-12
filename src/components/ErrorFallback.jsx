import { Button } from "@/components/ui/button";

export default function ErrorFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        We've logged the error. Try reloading the page — if it keeps happening, let us know.
      </p>
      <Button onClick={() => window.location.reload()}>Reload</Button>
    </div>
  );
}
