export default function LoadingSpinner({ className = "py-16" }) {
  return (
    <div className={`flex justify-center ${className}`}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" role="status" aria-label="Loading" />
    </div>
  );
}
