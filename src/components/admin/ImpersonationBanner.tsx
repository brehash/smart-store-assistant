import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "admin_impersonation";

export function saveAdminSession(accessToken: string, refreshToken: string) {
  sessionStorage.setItem(
    "admin_session",
    JSON.stringify({ access_token: accessToken, refresh_token: refreshToken })
  );
}

export function startImpersonation(displayName: string) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ display_name: displayName }));
  // Dispatch custom event so the banner re-reads immediately
  window.dispatchEvent(new CustomEvent("impersonation-start"));
}

export function isImpersonating(): boolean {
  return !!sessionStorage.getItem(STORAGE_KEY) && !!sessionStorage.getItem("admin_session");
}

export function ImpersonationBanner() {
  const [impersonation, setImpersonation] = useState<{ display_name: string } | null>(null);
  const navigate = useNavigate();

  const readState = () => {
    const data = sessionStorage.getItem(STORAGE_KEY);
    if (data && sessionStorage.getItem("admin_session")) {
      setImpersonation(JSON.parse(data));
    } else {
      setImpersonation(null);
    }
  };

  useEffect(() => {
    readState();
    const handler = () => readState();
    window.addEventListener("impersonation-start", handler);
    return () => window.removeEventListener("impersonation-start", handler);
  }, []);

  const stopImpersonation = async () => {
    const saved = sessionStorage.getItem("admin_session");
    if (saved) {
      const { access_token, refresh_token } = JSON.parse(saved);
      await supabase.auth.setSession({ access_token, refresh_token });
    }
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem("admin_session");
    setImpersonation(null);
    navigate("/admin");
  };

  if (!impersonation) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium shadow-md">
      <Eye className="h-4 w-4" />
      <span>Impersonating: {impersonation.display_name}</span>
      <Button
        variant="outline"
        size="sm"
        className="h-7 bg-amber-600 border-amber-700 text-amber-50 hover:bg-amber-700 hover:text-white"
        onClick={stopImpersonation}
      >
        <X className="h-3 w-3 mr-1" />
        Stop
      </Button>
    </div>
  );
}
