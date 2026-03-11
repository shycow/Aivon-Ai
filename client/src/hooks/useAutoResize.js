import { useEffect, useRef } from "react";

export function useAutoResize(value) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "0px";
    ref.current.style.height = `${Math.min(ref.current.scrollHeight, 200)}px`;
  }, [value]);

  return ref;
}