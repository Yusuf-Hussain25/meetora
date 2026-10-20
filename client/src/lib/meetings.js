import toast from "react-hot-toast";

export const MEETING_CODE_RE = /^[a-z]{3}-[a-z]{3}-[a-z]{3}$/;

// "abcdefghi", "ABC DEF GHI" or a full invite link -> "abc-def-ghi" (or the partial code while typing)
export const normalizeCode = (input = "") => {
    const fromLink = input.match(/\/meeting\/([a-z]{3}-[a-z]{3}-[a-z]{3})/i);
    if (fromLink) return fromLink[1].toLowerCase();
    const letters = input.toLowerCase().replace(/[^a-z]/g, "").slice(0, 9);
    return letters.match(/.{1,3}/g)?.join("-") || "";
};

export const inviteLink = (code) => `${window.location.origin}/meeting/${code}`;

export const copyText = async (text, message = "Copied") => {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(message);
        return true;
    } catch {
        toast.error("Couldn't copy. Select the text and copy it manually.");
        return false;
    }
};

// Pre-filled Google Calendar event for a scheduled meeting (opens in a new tab)
export const googleCalendarLink = ({ title, scheduledFor, meetingId, description = "" }, minutes = 30) => {
    const start = new Date(scheduledFor);
    const end = new Date(start.getTime() + minutes * 60000);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: title,
        dates: `${fmt(start)}/${fmt(end)}`,
        details: `${description ? `${description}\n\n` : ""}Join on Meetora: ${inviteLink(meetingId)}`,
        location: inviteLink(meetingId),
    });
    return `https://calendar.google.com/calendar/render?${params}`;
};

export const apiError = (err, fallback = "Something went wrong") =>
    err?.response?.data?.error || (err?.message === "Network Error" ? "Can't reach the Meetora server. Is it running?" : null) || fallback;
