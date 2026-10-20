import { getAuth, clerkClient } from "@clerk/express"
import {sql} from "../config/db.js"

export const protect = async (req, res, next) =>{
    const auth = getAuth(req);
    const userId = auth?.userId || req.auth?.userId;

    if(!userId){
        return res.status(401).json({ error: "Not authorized, authentication required" });
    }

    req.user = {id: userId};

    const userActivePlan = auth.has({plan: "premium"}) ? "premium" : "free";

    const users = await sql`SELECT name, plan FROM users WHERE id = ${userId}`

    // The Clerk webhook can't reach localhost, so create the row on first request if it's missing
    if(!users.length){
        const clerkUser = await clerkClient.users.getUser(userId)
        const email = clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses?.[0]?.emailAddress || ""
        const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || email.split("@")[0] || "User"
        await sql`
            INSERT INTO users (id, name, email, image, plan)
            VALUES (${userId}, ${name}, ${email}, ${clerkUser.imageUrl || ""}, ${userActivePlan})
            ON CONFLICT (id) DO NOTHING`
        return next()
    }

    const userPlan = users[0]?.plan;

    if(userActivePlan !== userPlan){
        await sql`UPDATE users SET plan = ${userActivePlan} WHERE id = ${userId}`
    }


    next()
}