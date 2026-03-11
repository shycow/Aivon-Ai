import { useEffect } from "react";

export function useTheme(initial = "dark") {
  useEffect(() => {
    document.documentElement.dataset.theme = initial;
  }, [initial]);
}