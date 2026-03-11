import { motion } from "framer-motion";
import { ProposalCard } from "../message/ProposalCard.jsx";

export function ToolPanel({ proposals, approvedMap, onToggle, onRun }) {
  if (!proposals.length) return null;

  return (
    <motion.section className="proposal-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <h3>Tool Proposals</h3>
      <div className="proposal-grid">
        {proposals.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            approved={approvedMap[proposal.id]}
            onToggle={() => onToggle(proposal.id)}
          />
        ))}
      </div>
      <button className="primary" onClick={onRun}>
        Run approved tools
      </button>
    </motion.section>
  );
}