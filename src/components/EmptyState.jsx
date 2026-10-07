export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-16 text-center">
      {Icon && <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground"><Icon className="h-6 w-6" /></span>}
      {title && <p className="font-display text-base font-semibold">{title}</p>}
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
