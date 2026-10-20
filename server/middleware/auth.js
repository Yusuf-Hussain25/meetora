import { getAuth } from "@clerk/express"
import { sql } from "../config/db.js"
import { ensureUser } from "../lib/users.js"

export const protect = async (req, res, next) =>{
    try {
        const auth = getAuth(req);
        const userId = auth?.userId;

        if(!userId){
            return res.status(401).json({ error: "Not authorized, authentication required" });
        }

        const user = await ensureUser(userId);
        req.user = { id: userId, name: user.name, plan: user.plan };

        // Keep the stored plan in sync with Clerk Billing
        const activePlan = auth.has({plan: "premium"}) ? "premium" : "free";
        if(activePlan !== user.plan){
            await sql`UPDATE users SET plan = ${activePlan}, updated_at = NOW() WHERE id = ${userId}`
            req.user.plan = activePlan;
        }

        next()
    } catch (error) {
        next(error)
    }
}
