import { useAutoResize } from "../../hooks/useAutoResize.js";
import { SendHorizontal, Paperclip, Mic } from "lucide-react";

export function Composer({ value, onChange, onSend, disabled }) {
  const ref = useAutoResize(value);
  const sendDisabled = disabled || !value.trim();

  return (
    <div className="composer">
      <button className="icon-btn" type="button" title="Attach file" disabled>
        <Paperclip size={16} />
      </button>
      <textarea
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Message Aivon..."
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
      />
      <button className="icon-btn" type="button" title="Voice mode" disabled>
        <Mic size={16} />
      </button>
      <button className="send-btn" type="button" onClick={onSend} disabled={sendDisabled}>
        <SendHorizontal size={18} />
      </button>
    </div>
  );
}
