import type { ReactNode } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";

/** Thin wrapper over React Router's Link so existing styling ([data-status="active"]) keeps working. */
export function Link({ to, children, className = "", ...props }: { to: string; children: ReactNode; className?: string; [key: string]: unknown }) {
  const { pathname } = useLocation();
  return (
    <RouterLink to={to} className={className} data-status={pathname === to ? "active" : undefined} onClick={() => window.scrollTo(0, 0)} {...props}>
      {children}
    </RouterLink>
  );
}

export function useNavigation() {
  const navigate = useNavigate();
  return { navigate: (to: string) => { navigate(to); window.scrollTo(0, 0); } };
}
