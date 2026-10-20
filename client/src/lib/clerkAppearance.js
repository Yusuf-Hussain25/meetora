// Clerk components (sign-in, user menu, pricing) styled with the Meetora palette.
// Clerk needs concrete colors, so we pass the values for the theme currently showing.
const palettes = {
    dark: {
        colorBackground: "#0e1412",
        colorForeground: "#f1f5f3",
        colorMutedForeground: "#a3b1ab",
        colorMuted: "#151d1a",
        colorInput: "#121a17",
        colorInputForeground: "#f1f5f3",
        colorBorder: "#26302c",
        colorNeutral: "#f1f5f3",
        colorShadow: "#000000",
        colorModalBackdrop: "#000000",
    },
    light: {
        colorBackground: "#ffffff",
        colorForeground: "#07140f",
        colorMutedForeground: "#4b5c55",
        colorMuted: "#f2f6f4",
        colorInput: "#f7faf9",
        colorInputForeground: "#07140f",
        colorBorder: "#dbe5e1",
        colorNeutral: "#07140f",
        colorShadow: "#06281c",
        colorModalBackdrop: "#06281c",
    },
};

export const clerkAppearance = (theme = "dark") => ({
    variables: {
        ...palettes[theme],
        colorPrimary: "#10b981",
        colorPrimaryForeground: "#03140f",
        colorDanger: "#f43f5e",
        colorSuccess: "#22c55e",
        colorWarning: "#f59e0b",
        colorRing: "#10b981",
        fontFamily: "'Geist', system-ui, sans-serif",
        borderRadius: "12px",
    },
    elements: {
        // Embedded inside our own glass card on the auth page
        cardBox: { boxShadow: "none", width: "100%", maxWidth: "100%" },
        card: { boxShadow: "none", background: "transparent", border: "none", padding: "4px 0 0" },
        footer: { background: "transparent" },
        formButtonPrimary: {
            background: "linear-gradient(135deg, #6ee7b7 0%, #10b981 38%, #14b8a6 68%, #22d3ee 110%)",
            color: "#03140f",
            fontWeight: 600,
            height: "44px",
            boxShadow: "0 6px 24px rgba(16,185,129,.32)",
        },
        socialButtonsBlockButton: { height: "44px" },
        formFieldInput: { height: "44px" },
        userButtonPopoverCard: { borderRadius: "18px" },
    },
});
