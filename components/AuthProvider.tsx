"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { Lock, Mail, ArrowRight, ShieldCheck, AlertCircle, Loader2, LogOut } from "lucide-react";

const HUB_URL = "https://ownpainel.vercel.app";
const HUB_SESSION_KEY = "@own-hub:session";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Estados do formulário de login
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function initAuth() {
      try {
        // 1. Verificar parâmetros do OWN Hub na URL (Token Relay & SSO)
        const params = new URLSearchParams(window.location.search);
        const hubUser = params.get("hub_user");
        const hubPass = params.get("hub_pass");
        const hubToken = params.get("hub_token");
        const hubName = params.get("hub_name");
        const hubRole = params.get("hub_role");

        let authSuccess = false;

        // Se veio com credenciais direto do OWN Hub
        if (hubUser && hubPass) {
          try {
            const decodedPassword = atob(hubPass);
            const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
              email: hubUser,
              password: decodedPassword,
            });

            if (!authErr && authData?.user) {
              const u: AuthUser = {
                id: authData.user.id,
                email: authData.user.email || hubUser,
                name: hubName || authData.user.email?.split("@")[0] || "Usuário",
                role: hubRole || "administrador",
              };
              setUser(u);
              localStorage.setItem(
                HUB_SESSION_KEY,
                JSON.stringify({ ...u, token: hubToken || "", expiresAt: Date.now() + 8 * 3600 * 1000 })
              );
              authSuccess = true;
            }
          } catch (e) {
            console.warn("Falha no login automático via hub_pass:", e);
          }
        }

        // Se veio apenas com token do Hub
        if (!authSuccess && hubToken && hubUser) {
          try {
            const decoded = JSON.parse(atob(hubToken));
            if (decoded.exp && Date.now() < decoded.exp) {
              const u: AuthUser = {
                id: decoded.uid || "hub-user",
                email: hubUser,
                name: hubName || hubUser.split("@")[0],
                role: hubRole || "operador",
              };
              setUser(u);
              localStorage.setItem(
                HUB_SESSION_KEY,
                JSON.stringify({ ...u, token: hubToken, expiresAt: decoded.exp })
              );
              authSuccess = true;
            }
          } catch (e) {
            console.warn("Falha ao decodificar hub_token:", e);
          }
        }

        // Limpar parâmetros da URL para estética limpa
        if (hubUser || hubToken || hubPass) {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("hub_user");
          cleanUrl.searchParams.delete("hub_pass");
          cleanUrl.searchParams.delete("hub_token");
          cleanUrl.searchParams.delete("hub_name");
          cleanUrl.searchParams.delete("hub_role");
          window.history.replaceState({}, "", cleanUrl.toString());
        }

        if (authSuccess) {
          setLoading(false);
          return;
        }

        // 2. Verificar sessão ativa no Supabase Auth
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          const authU = sessionData.session.user;
          // Buscar profile no hub_profiles se existir
          const { data: profile } = await supabase
            .from("hub_profiles")
            .select("name, role")
            .eq("id", authU.id)
            .single();

          setUser({
            id: authU.id,
            email: authU.email || "",
            name: profile?.name || authU.email?.split("@")[0] || "Usuário",
            role: profile?.role || "administrador",
          });
          setLoading(false);
          return;
        }

        // 3. Verificar sessão salva no LocalStorage (Hub Session)
        const savedHubRaw = localStorage.getItem(HUB_SESSION_KEY);
        if (savedHubRaw) {
          try {
            const saved = JSON.parse(savedHubRaw);
            if (saved.expiresAt && Date.now() < saved.expiresAt) {
              setUser({
                id: saved.id || saved.userId || "local-user",
                email: saved.email || saved.userEmail,
                name: saved.name || saved.userName || "Usuário",
                role: saved.role || saved.userRole || "operador",
              });
              setLoading(false);
              return;
            } else {
              localStorage.removeItem(HUB_SESSION_KEY);
            }
          } catch {
            localStorage.removeItem(HUB_SESSION_KEY);
          }
        }
      } catch (err) {
        console.error("Erro na inicialização de autenticação:", err);
      } finally {
        setLoading(false);
      }
    }

    initAuth();

    // Ouvinte para mudanças de sessão do Supabase
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, curSession) => {
      if (curSession?.user) {
        const authU = curSession.user;
        const { data: profile } = await supabase
          .from("hub_profiles")
          .select("name, role")
          .eq("id", authU.id)
          .single();

        setUser({
          id: authU.id,
          email: authU.email || "",
          name: profile?.name || authU.email?.split("@")[0] || "Usuário",
          role: profile?.role || "administrador",
        });
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setSubmitting(true);

    try {
      if (!emailInput.trim() || !passwordInput) {
        setLoginError("Informe o e-mail e a senha de acesso.");
        setSubmitting(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput.trim(),
        password: passwordInput,
      });

      if (error || !data.user) {
        setLoginError(error?.message || "E-mail ou senha incorretos.");
        setSubmitting(false);
        return;
      }

      // Buscar perfil
      const { data: profile } = await supabase
        .from("hub_profiles")
        .select("name, role")
        .eq("id", data.user.id)
        .single();

      const u: AuthUser = {
        id: data.user.id,
        email: data.user.email || emailInput,
        name: profile?.name || data.user.email?.split("@")[0] || "Usuário",
        role: profile?.role || "administrador",
      };

      setUser(u);
      localStorage.setItem(
        HUB_SESSION_KEY,
        JSON.stringify({ ...u, expiresAt: Date.now() + 8 * 3600 * 1000 })
      );
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Erro ao efetuar login.");
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignora erro
    }
    localStorage.removeItem(HUB_SESSION_KEY);
    setUser(null);
  };

  // 1. Tela de Carregamento
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0F12] flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 flex items-center justify-center animate-pulse">
          <Image src="/logo.png" alt="OWN BARBER CLUB" width={64} height={64} className="object-contain" priority />
        </div>
        <div className="flex items-center gap-2 text-gray-400 font-rajdhani text-sm tracking-wider uppercase">
          <Loader2 size={16} className="animate-spin text-[#E51E25]" />
          Verificando credenciais...
        </div>
      </div>
    );
  }

  // 2. Tela de Login (quando não autenticado)
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0D0F12] flex items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Fundo com efeito glow suave */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#E51E25] opacity-10 blur-[120px] pointer-events-none rounded-full"></div>
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-red-900 opacity-5 blur-[100px] pointer-events-none"></div>

        <div className="w-full max-w-md bg-[#121418] border border-[#22262E] rounded-xl shadow-2xl p-8 relative z-10">
          {/* Logo e Título */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center p-1 bg-[#181B20] border border-[#2A2E38] rounded-xl shadow-inner">
              <Image src="/logo.png" alt="OWN BARBER CLUB" width={48} height={48} className="object-contain" priority />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E51E25]/10 border border-[#E51E25]/30 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E51E25] animate-pulse"></span>
              <span className="text-[11px] font-mono text-[#E51E25] uppercase tracking-wider font-semibold">
                OWN HUB CONNECT
              </span>
            </div>
            <h1 className="text-2xl font-rajdhani font-bold text-white uppercase tracking-wider">
              OWN ADMINISTRATIVO
            </h1>
            <p className="text-gray-400 text-xs mt-1">
              Acesso restrito à gestão financeira e controladoria
            </p>
          </div>

          {/* Alerta de Erro */}
          {loginError && (
            <div className="mb-6 p-3 rounded-lg bg-red-950/50 border border-red-800/80 flex items-center gap-2.5 text-red-200 text-xs animate-shake">
              <AlertCircle size={16} className="text-[#E51E25] shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          {/* Formulário de Login */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-rajdhani uppercase font-semibold text-gray-300 mb-1.5 tracking-wider">
                E-mail
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="exemplo@ownbarberclub.com"
                  className="w-full bg-[#181B20] border border-[#2A2E38] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#E51E25] focus:ring-1 focus:ring-[#E51E25] transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-rajdhani uppercase font-semibold text-gray-300 mb-1.5 tracking-wider">
                Senha
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#181B20] border border-[#2A2E38] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#E51E25] focus:ring-1 focus:ring-[#E51E25] transition"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-[#E51E25] to-[#B00400] hover:from-[#f02229] hover:to-[#c40500] text-white font-rajdhani font-bold uppercase tracking-wider text-sm rounded-lg shadow-lg shadow-red-950/50 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Autenticando...
                </>
              ) : (
                <>
                  Entrar no Sistema
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Divisor */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#22262E]"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-widest">
              <span className="bg-[#121418] px-3 text-gray-500">ou</span>
            </div>
          </div>

          {/* Botão para Acessar pelo OWN Hub */}
          <a
            href={HUB_URL}
            className="w-full py-2.5 px-4 bg-[#181B20] hover:bg-[#20242B] border border-[#2A2E38] text-gray-300 hover:text-white font-rajdhani font-semibold text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition"
          >
            <ShieldCheck size={16} className="text-[#E51E25]" />
            Acessar pelo OWN Hub
          </a>

          <div className="mt-6 text-center text-[11px] text-gray-600 font-mono">
            OWN BARBER CLUB • SISTEMA SEGURO
          </div>
        </div>
      </div>
    );
  }

  // 3. Sistema liberado
  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Componente para exibir o Usuário Logado e Botão de Logout na Sidebar
export function UserProfileBadge() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const initials = user.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "US";

  return (
    <div className="p-3 bg-[#181B20] border-t border-[#22262E] flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 overflow-hidden">
        <div className="w-8 h-8 rounded-md bg-[#E51E25]/15 border border-[#E51E25]/30 flex items-center justify-center text-[#E51E25] font-rajdhani font-bold text-xs shrink-0">
          {initials}
        </div>
        <div className="overflow-hidden">
          <div className="text-xs font-semibold text-white truncate leading-tight font-rajdhani">
            {user.name}
          </div>
          <div className="text-[10px] text-gray-400 truncate leading-tight">
            {user.email}
          </div>
        </div>
      </div>

      <button
        onClick={logout}
        title="Sair do Sistema"
        className="p-1.5 text-gray-400 hover:text-[#E51E25] hover:bg-[#22262E] rounded transition shrink-0 cursor-pointer"
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}
