export function ProposalCard({ proposal, approved, onToggle }) {
  return (
    <div className="proposal-card">
      <div className="proposal-header">
        <span>{proposal.tool}</span>
        <label className="switch">
          <input type="checkbox" checked={approved} onChange={onToggle} />
          <span className="slider" />
        </label>
      </div>
      <div className="proposal-body">
        <p>{proposal.reason}</p>
        <code>{JSON.stringify(proposal.args)}</code>
      </div>
    </div>
  );
}