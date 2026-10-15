import { useEffect, useState } from "react";
import { API_BASE_URL, tokenStore } from "../api/client";

/** Fetch protected images with a bearer token, never via a publicly accessible URL. */
export function ResearchScanImage({ scanId, alt, className }: { scanId: string; alt: string; className?: string }) {
  const [source, setSource] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    const token = tokenStore.get();
    if (!token) return;
    fetch(`${API_BASE_URL}/api/research-scans/${encodeURIComponent(scanId)}/image`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store"
    }).then((res) => {
      if (!res.ok) throw new Error("Image access unavailable");
      return res.blob();
    }).then((blob) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setSource(objectUrl);
    }).catch(() => { if (!cancelled) setSource(undefined); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [scanId]);
  return source
    ? <img src={source} alt={alt} className={className} style={{ maxWidth: "100%", objectFit: "cover", borderRadius: 6 }} />
    : <div role="status" className={className} style={{ color: "var(--muted-foreground)", padding: 12 }}>Image unavailable or loading...</div>;
}
