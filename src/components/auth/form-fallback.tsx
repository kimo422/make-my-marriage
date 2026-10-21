/** Placeholder with roughly the form's height while it reads the URL on the client. */
export function FormFallback({ fields = 2 }: { fields?: number }) {
  return (
    <div className="space-y-5" aria-hidden="true">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="bg-stone h-4 w-28 rounded" />
          <div className="bg-field border-hairline rounded-field h-12 border" />
        </div>
      ))}
      <div className="bg-stone h-12 rounded-full" />
    </div>
  );
}
