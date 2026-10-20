import { useEffect, useState } from "react";
import { onThemeChange, resolveTheme } from "../lib/theme";

// Current resolved theme ("light" | "dark"), updated on manual toggles and system changes.
export const useTheme = () => {
    const [theme, setTheme] = useState(() => resolveTheme());
    useEffect(() => onThemeChange(setTheme), []);
    return theme;
};
