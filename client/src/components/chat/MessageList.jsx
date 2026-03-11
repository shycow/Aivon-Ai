import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef } from "react";
import { MessageItem } from "../message/MessageItem.jsx";

export function MessageList({ messages, onRegenerate, onEditPrompt }) {
  const parentRef = useRef(null);
  const items = useMemo(() => messages || [], [messages]);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 160,
    overscan: 6
  });

  useEffect(() => {
    if (items.length) {
      rowVirtualizer.scrollToIndex(items.length - 1);
    }
  }, [items.length, rowVirtualizer]);

  return (
    <div className="message-list" ref={parentRef}>
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative"
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const message = items[virtualRow.index];
          return (
            <div
              key={message.id}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              <MessageItem
                message={message}
                onRegenerate={() => onRegenerate?.(message)}
                onEditPrompt={() => onEditPrompt?.(message)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
