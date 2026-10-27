import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { I18nManager } from "react-native";
import { api, type ApiOptions } from "./api";
import { translator, type Locale } from "./i18n";

export interface Me {
  user: { id: string; name: string; phone: string; locale: Locale };
  isStaff: boolean;
  roles: string[];
  permissions: string[];
  customer: { id: string; number: string; type: "B2C" | "B2B"; status: string; displayName: string } | null;
  channel: "B2C" | "B2B";
}

interface SessionValue {
  ready: boolean;
  token: string | null;
  me: Me | null;
  locale: Locale;
  setLocale: (l: Locale) => Promise<void>;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  /** API-Aufruf mit Token und Sprache */
  call: <T>(path: string, opts?: ApiOptions) => Promise<T>;
  tr: ReturnType<typeof translator>;
  isDriver: boolean;
}

const Ctx = createContext<SessionValue | null>(null);
const TOKEN_KEY = "sa_token";
const LOCALE_KEY = "sa_locale";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [locale, setLocaleState] = useState<Locale>("ar");

  const call = useCallback(<T,>(path: string, opts: ApiOptions = {}) => api<T>(path, { token, locale, ...opts }), [token, locale]);

  const loadMe = useCallback(async (t: string | null, l: Locale) => {
    if (!t) return setMe(null);
    try {
      setMe(await api<Me>("/api/v1/me", { token: t, locale: l }));
    } catch {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setToken(null);
      setMe(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const [t, l] = await Promise.all([SecureStore.getItemAsync(TOKEN_KEY), SecureStore.getItemAsync(LOCALE_KEY)]);
      const loc: Locale = l === "en" ? "en" : "ar";
      // Arabisch = RTL (wirkt nach Neustart der App)
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(loc === "ar");
      setLocaleState(loc);
      setToken(t);
      await loadMe(t, loc);
      setReady(true);
    })();
  }, [loadMe]);

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      token,
      me,
      locale,
      tr: translator(locale),
      isDriver: !!me?.isStaff && (me.permissions.includes("*") || me.permissions.includes("delivery.driver")),
      call,
      setLocale: async (l) => {
        await SecureStore.setItemAsync(LOCALE_KEY, l);
        I18nManager.forceRTL(l === "ar");
        setLocaleState(l);
      },
      signIn: async (t) => {
        await SecureStore.setItemAsync(TOKEN_KEY, t);
        setToken(t);
        await loadMe(t, locale);
      },
      signOut: async () => {
        try {
          await api("/api/v1/auth/logout", { token, method: "POST", body: {} });
        } catch {
          // Token wird ohnehin verworfen
        }
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setToken(null);
        setMe(null);
      },
      refresh: () => loadMe(token, locale),
    }),
    [ready, token, me, locale, call, loadMe],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("SessionProvider missing");
  return v;
}
