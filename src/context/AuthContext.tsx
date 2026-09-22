"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, UserRole } from "@/types/auth";
import { ApiError } from "@/lib/api/client";
import * as authApi from "@/lib/api/auth";

interface AuthContextValue {
  user: Session | null;
  isAuthenticated: boolean;
  /** False until the initial GET /auth/me (or a failed attempt at it) resolves — mirrors the old localStorage hydration flag so every existing guard/consumer needs no change. */
  isHydrated: boolean;
  signIn: (input: {
    email: string;
    password: string;
  }) => Promise<{ ok: true; role: UserRole } | { ok: false; error: string }>;
  signUp: (input: {
    name: string;
    email: string;
    phone?: string;
    password: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "E-mail ou senha inválidos.";
    if (error.status === 400) return "Verifique o e-mail e a senha informados.";
    // Antes disso, um status <= 0 (rede indisponível OU o diagnóstico
    // específico de "login funcionou mas a sessão não carregou", lançado
    // por login() em lib/api/auth.ts) caía nesta função sem cair em
    // nenhum dos dois casos acima, então a mensagem genérica de baixo era
    // usada mesmo quando ApiError já trazia um texto mais específico e
    // útil (ex.: apontando um problema de cookie/CORS em vez de "sem
    // conexão", ou simplesmente reportando um retry que falhou de novo).
    // error.message sempre existe e é apropriado pra mostrar ao usuário
    // nesses casos — não precisa mais filtrar por status.
    return error.message;
  }
  return "Não foi possível conectar ao servidor. Tente novamente.";
}

function registerErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return "Este e-mail já está cadastrado.";
    if (error.status === 400) return "Verifique os dados informados.";
    // Mesmo raciocínio de loginErrorMessage logo acima: sempre usar
    // error.message em vez de filtrar por status > 0 — client.ts já
    // atribui o texto certo ("Não foi possível conectar ao servidor...")
    // pra falha de rede real, então não há nada a ganhar filtrando aqui.
    return error.message;
  }
  return "Não foi possível conectar ao servidor. Tente novamente.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Session | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    authApi
      .getSession()
      .then((session) => {
        if (!cancelled) setUser(session);
      })
      .catch(() => {
        // A transient failure (gateway/identity-service unreachable) is
        // treated the same as "not logged in" here — every guard already
        // redirects an unauthenticated visitor to /acesso, which is the
        // right outcome when we genuinely can't confirm a session either
        // way, rather than leaving the app stuck on a loading state.
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async (input: { email: string; password: string }) => {
      try {
        const session = await authApi.login(input);
        setUser(session);
        return { ok: true as const, role: session.role };
      } catch (error) {
        return { ok: false as const, error: loginErrorMessage(error) };
      }
    },
    [],
  );

  const signUp = useCallback(
    async (input: {
      name: string;
      email: string;
      phone?: string;
      password: string;
    }) => {
      try {
        await authApi.registerCustomer(input);
        return { ok: true as const };
      } catch (error) {
        return { ok: false as const, error: registerErrorMessage(error) };
      }
    },
    [],
  );

  const signOut = useCallback(() => {
    // Optimistic: every existing caller does `signOut(); router.push("/acesso")`
    // right after, with no await — clearing local state synchronously keeps
    // that working unchanged. The actual POST /auth/logout (which revokes
    // the session server-side) runs in the background; if it fails, the
    // session cookie simply outlives the client state until it expires —
    // not surfaced to the user, same fire-and-forget contract the previous
    // localStorage-based signOut had.
    setUser(null);
    void authApi.logout().catch(() => {
      /* see comment above */
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isHydrated,
      signIn,
      signUp,
      signOut,
    }),
    [user, isHydrated, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  }
  return context;
}
