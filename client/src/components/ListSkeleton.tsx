export default function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="list-skeleton" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div className="list-skeleton-row" key={i}>
          <span className="sk sk-avatar" />
          <span className="sk sk-line sk-line-long" />
          <span className="sk sk-line sk-line-short" />
        </div>
      ))}
    </div>
  );
}
