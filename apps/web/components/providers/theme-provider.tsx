"use client";

import * as React from "react";

type Theme = "light" | "dark" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  attribute?: "class";
  defaultTheme?: Theme;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
};

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: string) => void;
  resolvedTheme: "light" | "dark";
};

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "light",
});

const getSystemTheme = (): "light" | "dark" => {
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  return "light";
};

const isTheme = (value: string | null): value is Theme =>
  value === "light" || value === "dark" || value === "system";

const readStoredTheme = (): Theme | null => {
  try {
    const storedTheme = window.localStorage.getItem("theme");
    return isTheme(storedTheme) ? storedTheme : null;
  } catch {
    return null;
  }
};

const writeStoredTheme = (theme: Theme) => {
  try {
    window.localStorage.setItem("theme", theme);
  } catch {
    // Storage can be unavailable in private browsing or restricted contexts.
  }
};

export function ThemeProvider({
  children,
  defaultTheme = "system",
  enableSystem = true,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] =
    React.useState<"light" | "dark">("light");

  React.useEffect(() => {
    const storedTheme = readStoredTheme();
    if (storedTheme) {
      setThemeState(storedTheme);
    }
  }, []);

  React.useEffect(() => {
    const applyTheme = () => {
      const nextResolvedTheme: "light" | "dark" =
        theme === "system" ? getSystemTheme() : theme;

      document.documentElement.classList.toggle(
        "dark",
        nextResolvedTheme === "dark",
      );
      document.documentElement.style.colorScheme = nextResolvedTheme;
      setResolvedTheme(nextResolvedTheme);
    };

    applyTheme();

    if (theme !== "system" || !enableSystem) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", applyTheme);

    return () => {
      mediaQuery.removeEventListener("change", applyTheme);
    };
  }, [enableSystem, theme]);

  const setTheme = React.useCallback((nextTheme: string) => {
    if (!isTheme(nextTheme)) {
      return;
    }

    setThemeState(nextTheme);
    writeStoredTheme(nextTheme);
  }, []);

  const value = React.useMemo(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
    }),
    [resolvedTheme, setTheme, theme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => React.useContext(ThemeContext);
