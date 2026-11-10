import Mascot from "@/components/Mascot";

// Empty pages get Tal (thinking by default) instead of a bare icon.
// Pass mascot={false} to keep the small icon, or a pose name to pick one.
export default function EmptyState({ icon: Icon, title, description, action, mascot = "thinking" }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-14 text-center">
      {mascot ? <Mascot pose={mascot} className="h-36 w-28" />
        : Icon && <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground"><Icon className="h-6 w-6" /></span>}
      {title && <p className="font-display text-lg font-semibold tracking-tight">{title}</p>}
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
