// Theme preference: "light" | "dark" | "system" (default). Applied as data-theme on <html>.
// index.html applies the saved value before first paint so there is no flash.
const KEY = "meetora-theme";
const listeners = new Set();

export const getThemePreference = () => {
    try {
        return localStorage.getItem(KEY) || "system";
    } catch {
        return "system";
    }
};

export const resolveTheme = (pref = getThemePreference()) => {
    if (pref !== "system") return pref;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
};

export const applyTheme = (pref = getThemePreference()) => {
    const root = document.documentElement;
    if (pref === "system") {
        root.removeAttribute("data-theme");
    } else {
        root.setAttribute("data-theme", pref);
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", resolveTheme(pref) === "light" ? "#f2f6f4" : "#050807");
    listeners.forEach((fn) => fn(resolveTheme(pref)));
};

export const setThemePreference = (pref) => {
    try {
        localStorage.setItem(KEY, pref);
    } catch {
        // storage unavailable (private mode): theme still applies for this session
    }
    applyTheme(pref);
};

// Flips between light and dark, starting from whatever is showing now.
export const toggleTheme = () => {
    const next = resolveTheme() === "light" ? "dark" : "light";
    setThemePreference(next);
    return next;
};

// Subscribe to the resolved theme ("light" | "dark"), including system changes.
export const onThemeChange = (fn) => {
    listeners.add(fn);
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onSystem = () => {
        if (getThemePreference() === "system") fn(resolveTheme("system"));
    };
    media.addEventListener("change", onSystem);
    return () => {
        listeners.delete(fn);
        media.removeEventListener("change", onSystem);
    };
};
