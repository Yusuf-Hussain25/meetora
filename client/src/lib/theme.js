// Theme: "light" (default) or "dark". Applied as data-theme on <html>.
// index.html applies a saved dark choice before first paint so there is no flash.
const KEY = "meetora-theme";
const listeners = new Set();

export const getThemePreference = () => {
    try {
        return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
    } catch {
        return "light";
    }
};

export const resolveTheme = (pref = getThemePreference()) => (pref === "dark" ? "dark" : "light");

export const applyTheme = (pref = getThemePreference()) => {
    const theme = resolveTheme(pref);
    document.documentElement.setAttribute("data-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f2f6f4" : "#050807");
    listeners.forEach((fn) => fn(theme));
};

export const setThemePreference = (pref) => {
    try {
        localStorage.setItem(KEY, pref);
    } catch {
        // storage unavailable (private mode): theme still applies for this session
    }
    applyTheme(pref);
};

// Flips between light and dark.
export const toggleTheme = () => {
    const next = resolveTheme() === "light" ? "dark" : "light";
    setThemePreference(next);
    return next;
};

// Subscribe to theme changes ("light" | "dark").
export const onThemeChange = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};
