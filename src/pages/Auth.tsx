import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Store, Sparkles, BarChart3, Brain, Users } from "lucide-react";

interface InviteInfo {
  email: string;
  team_name: string;
  inviter_name: string;
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite_token");

  // Fetch invite info for logged-out users
  useEffect(() => {
    if (inviteToken && !user) {
      setInviteLoading(true);
      fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/team?invite_info=${inviteToken}`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      )
        .then((r) => r.json())
        .then((data) => {
          if (data.email) {
            setInviteInfo(data);
            setEmail(data.email);
          }
        })
        .catch(() => {})
        .finally(() => setInviteLoading(false));
    }
  }, [inviteToken, user]);

  // If user is logged in and has invite token, accept it (with guard against double-fire)
  const acceptingRef = useRef(false);
  useEffect(() => {
    if (user && inviteToken && !acceptingRef.current) {
      acceptingRef.current = true;
      const acceptInvite = async () => {
        try {
          const session = await supabase.auth.getSession();
          const token = session.data.session?.access_token;
          const resp = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/team?accept_token=${inviteToken}`,
            {
              method: "GET",
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          const result = await resp.json();
          if (!resp.ok) throw new Error(result.error);
          toast({ title: "Bine ai venit în echipă!", description: "Te-ai alăturat cu succes echipei." });
        } catch (e: any) {
          toast({ title: "Eroare invitație", description: e.message, variant: "destructive" });
        }
        // Clean invite_token from URL and navigate home
        navigate("/", { replace: true });
      };
      acceptInvite();
    }
  }, [user, inviteToken]);

  if (user && !inviteToken) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!inviteToken) navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({ title: "Cont creat!", description: "Verifică-ți emailul pentru a confirma contul." });
      }
    } catch (error: any) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Store, label: "Integrare WooCommerce", desc: "Gestionează magazinul cu limbaj natural" },
    { icon: Sparkles, label: "Bazat pe AI", desc: "Căutare inteligentă de produse & creare comenzi" },
    { icon: BarChart3, label: "Analize", desc: "Rapoarte de vânzări & grafice vizuale" },
    { icon: Brain, label: "Învață stilul tău", desc: "Memorează aliasurile tale de produse" },
  ];

  return (
    <div className="flex min-h-[100dvh]">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 bg-primary text-primary-foreground">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Asistent AI WooCommerce</h1>
        <p className="text-lg opacity-90 mb-10">
          Discută cu magazinul tău. Creează comenzi, caută produse și obține analize — totul prin conversație.
        </p>
        <div className="space-y-6">
          {features.map((f) => (
            <div key={f.label} className="flex items-start gap-4">
              <div className="rounded-lg bg-primary-foreground/10 p-2.5">
                <f.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">{f.label}</p>
                <p className="text-sm opacity-75">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-4 sm:p-6">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardHeader className="text-center">
            {inviteToken && inviteInfo ? (
              <>
                <div className="mx-auto mb-3 sm:mb-4 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <CardTitle className="text-xl sm:text-2xl">Ești invitat!</CardTitle>
                <CardDescription>
                  <strong>{inviteInfo.inviter_name}</strong> te-a invitat să te alături echipei{" "}
                  <strong>{inviteInfo.team_name}</strong>. Autentifică-te sau creează un cont pentru a accepta.
                </CardDescription>
              </>
            ) : (
              <>
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Store className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl">{isLogin ? "Bine ai revenit" : "Creează cont"}</CardTitle>
                <CardDescription>
                  {isLogin ? "Autentifică-te în asistentul tău WooCommerce" : "Începe cu asistentul tău AI"}
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent>
            {inviteLoading ? (
              <div className="text-center py-4 text-muted-foreground">Se încarcă detaliile invitației...</div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Nume complet</Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Numele tău"
                        required={!isLogin}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      readOnly={!!inviteInfo}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Parolă</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Se încarcă..." : isLogin ? "Autentificare" : "Creează cont"}
                  </Button>
                </form>
                <div className="mt-6 text-center text-sm text-muted-foreground">
                  {isLogin ? "Nu ai cont?" : "Ai deja cont?"}{" "}
                  <button
                    onClick={() => setIsLogin(!isLogin)}
                    className="font-medium text-primary hover:underline"
                  >
                    {isLogin ? "Înregistrează-te" : "Autentifică-te"}
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
