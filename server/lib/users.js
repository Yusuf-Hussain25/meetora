import { clerkClient } from "@clerk/express";
import { sql } from "../config/db.js";

const displayName = (u) => {
    const email = u.primaryEmailAddress?.emailAddress || u.emailAddresses?.[0]?.emailAddress || "";
    return {
        email,
        name: [u.firstName, u.lastName].filter(Boolean).join(" ") || email.split("@")[0] || "User",
    };
};

// Returns the users row for a Clerk id, creating it from Clerk when it doesn't exist yet.
// The Clerk webhook normally creates it, but it can't reach localhost during development.
export const ensureUser = async (userId) => {
    const rows = await sql`SELECT id, name, email, image, plan FROM users WHERE id = ${userId}`;
    if (rows.length) return rows[0];

    const clerkUser = await clerkClient.users.getUser(userId);
    const { name, email } = displayName(clerkUser);
    const [created] = await sql`
        INSERT INTO users (id, name, email, image, plan)
        VALUES (${userId}, ${name}, ${email}, ${clerkUser.imageUrl || ""}, 'free')
        ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
        RETURNING id, name, email, image, plan`;
    return created;
};
