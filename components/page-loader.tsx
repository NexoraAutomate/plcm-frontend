export function PageLoader({ className }: { className?: string }) {
  return (
    <div
      className={
        className ??
        'flex min-h-[calc(100vh-7rem)] w-full items-center justify-center'
      }
    >
      <div className="loader" aria-label="Loading" role="status" />
    </div>
  );
}
