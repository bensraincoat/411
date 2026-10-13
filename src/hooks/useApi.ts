import { useEffect, useState } from "react";
import { errorMessage } from "../api";

/** Loads data from the API once; keeps `fallback` visible while loading or if the server is unavailable. */
export function useApi<T>(load: () => Promise<T>, fallback: T, deps: unknown[] = []) {
  const [data, setData] = useState<T>(fallback);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    load()
      .then((value) => { if (active) { setData(value); setError(""); } })
      .catch((err) => { if (active) setError(errorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, setData, error, loading };
}
