import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/react";
import toast from "react-hot-toast";
import api from "../config/api";
import { apiError } from "../lib/meetings";

// Creates an instant meeting and opens its lobby.
export const useStartMeeting = () => {
    const navigate = useNavigate();
    const { user } = useUser();
    const [starting, setStarting] = useState(false);

    const start = async (title) => {
        if (starting) return;
        setStarting(true);
        try {
            const first = user?.firstName || user?.fullName || "My";
            const { data } = await api.post("/api/meetings", { title: title || `${first}'s meeting` });
            navigate(`/meeting/${data.meeting.meetingId}`);
        } catch (err) {
            toast.error(apiError(err, "Couldn't start a meeting"));
        } finally {
            setStarting(false);
        }
    };

    return { start, starting };
};
