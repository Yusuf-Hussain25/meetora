import express from "express";
import { protect } from "../middleware/auth.js";
import { createMeeting, deleteMeeting, getMeeting, getMeetingStats, getSessionDetails, getUpcoming, getUserSessions } from "../controllers/meetingController.js";

const meetingRouter = express.Router();

meetingRouter.post("/", protect, createMeeting);
meetingRouter.get("/stats", protect, getMeetingStats);
meetingRouter.get("/upcoming", protect, getUpcoming);
meetingRouter.get("/sessions", protect, getUserSessions);
meetingRouter.get("/sessions/:id", protect, getSessionDetails);
meetingRouter.get("/:meetingId", protect, getMeeting);
meetingRouter.delete("/:meetingId", protect, deleteMeeting);

export default meetingRouter;
