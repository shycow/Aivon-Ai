export function DebugPanel({ summary, events }) {
  if (!summary && (!events || events.length === 0)) return null;

  return (
    <section className="debug-panel">
      <h3>Debug</h3>
      <p>{summary || "No planner summary yet."}</p>
      <div className="timeline">
        {events.map((event, idx) => (
          <div key={`${event.type}-${idx}`} className="timeline-item">
            <span>{event.type}</span>
            <code>{JSON.stringify(event.payload || {})}</code>
          </div>
        ))}
      </div>
    </section>
  );
}
