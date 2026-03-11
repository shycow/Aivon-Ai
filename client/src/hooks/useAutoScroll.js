import { useEffect, useRef } from "react";

export function useAutoScroll(deps) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.scrollTop = ref.current.scrollHeight;
  }, deps);

  return ref;
}