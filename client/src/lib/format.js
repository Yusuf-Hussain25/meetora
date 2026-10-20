// Date and duration helpers shared by the dashboard, meeting room and session history.

export const toDate = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// "9:05 PM"
export const formatTime = (value) => {
    const date = toDate(value);
    if (!date) return "";
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

// "Today", "Yesterday", "Tomorrow", "Mon, 12 Oct"
export const formatDayLabel = (value) => {
    const date = toDate(value);
    if (!date) return "";
    const now = new Date();
    if (sameDay(date, now)) return "Today";
    const shifted = (days) => {
        const d = new Date(now);
        d.setDate(now.getDate() + days);
        return d;
    };
    if (sameDay(date, shifted(-1))) return "Yesterday";
    if (sameDay(date, shifted(1))) return "Tomorrow";
    const opts = { weekday: "short", day: "numeric", month: "short" };
    if (date.getFullYear() !== now.getFullYear()) opts.year = "numeric";
    return date.toLocaleDateString([], opts);
};

// "Today · 9:05 PM"
export const formatDateTime = (value) => {
    const date = toDate(value);
    if (!date) return "";
    return `${formatDayLabel(date)} · ${formatTime(date)}`;
};

// "just now", "5m ago", "3h ago", "2d ago", "in 20m", "in 3h"
export const formatRelative = (value) => {
    const date = toDate(value);
    if (!date) return "";
    const diff = date.getTime() - Date.now();
    const abs = Math.abs(diff);
    const mins = Math.round(abs / 60000);
    const label =
        mins < 1 ? null :
        mins < 60 ? `${mins}m` :
        mins < 60 * 24 ? `${Math.round(mins / 60)}h` :
        mins < 60 * 24 * 30 ? `${Math.round(mins / 1440)}d` :
        null;
    if (!label) return mins < 1 ? "just now" : formatDayLabel(date);
    return diff > 0 ? `in ${label}` : `${label} ago`;
};

// 75 min -> "1h 15m", 4 min -> "4m", 20 s -> "<1m"
export const formatDuration = (ms) => {
    if (!ms || ms < 0) return "0m";
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "<1m";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
};

// Live meeting timer: "04:09" or "1:04:09"
export const formatClock = (ms) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return h ? `${h}:${m}:${s}` : `${m}:${s}`;
};

export const meetingDuration = (meeting) => {
    const start = toDate(meeting?.startedAt || meeting?.createdAt);
    if (!start) return 0;
    const end = toDate(meeting?.endedAt) || new Date();
    return end - start;
};

export const greeting = (date = new Date()) => {
    const h = date.getHours();
    if (h < 5) return "Working late";
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
};
