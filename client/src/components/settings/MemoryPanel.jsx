export function MemoryPanel({ memories, suggestions, onSave, onDelete, onEdit, onReject }) {
  return (
    <aside className="memory-panel">
      <h3>Memories</h3>
      <div className="memory-list">
        {memories.map((memory) => (
          <div key={memory.id} className="memory-item">
            <span>{memory.content}</span>
            <div className="memory-actions">
              <button onClick={() => onEdit?.(memory)}>Edit</button>
              <button onClick={() => onDelete(memory.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      {suggestions.length ? (
        <div className="memory-suggestions">
          <h4>Suggestions</h4>
          {suggestions.map((item, idx) => (
            <div key={`${item.content}-${idx}`} className="memory-item">
              <span>{item.content}</span>
              <div className="memory-actions">
                <button onClick={() => onSave(item)}>Save</button>
                <button onClick={() => onReject?.(item)}>Dismiss</button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
