import express from "express";
import { protect } from "../middleware/auth.js";
import { aiStatus, askMeeting, catchUp, draftAgenda, getRecap } from "../controllers/aiController.js";

const aiRouter = express.Router();

aiRouter.get("/status", protect, aiStatus);
aiRouter.post("/agenda", protect, draftAgenda);
aiRouter.get("/meetings/:meetingId/recap", protect, getRecap);
aiRouter.post("/meetings/:meetingId/recap", protect, getRecap);
aiRouter.post("/meetings/:meetingId/ask", protect, askMeeting);
aiRouter.post("/meetings/:meetingId/catchup", protect, catchUp);

export default aiRouter;
