import { motion } from "framer-motion";

export function TypingIndicator() {
  return (
    <div className="typing-indicator" aria-label="Assistant is typing">
      <span />
      <span />
      <span />
    </div>
  );
}

export function MessageSkeleton() {
  return (
    <motion.div className="message assistant" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="avatar">AI</div>
      <div className="bubble">
        <TypingIndicator />
      </div>
    </motion.div>
  );
}