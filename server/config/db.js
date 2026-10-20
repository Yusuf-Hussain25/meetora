import { neon } from '@neondatabase/serverless';

if(!process.env.DATABASE_URL){
    throw new Error("DATABASE_URL is not defined in environment variables");
}

export const sql = neon(process.env.DATABASE_URL);

export async function initDB() {
    try {
        await sql`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                image VARCHAR(500),
                plan VARCHAR(20) DEFAULT 'free',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS meetings (
                id SERIAL PRIMARY KEY,
                meeting_id VARCHAR(50) NOT NULL UNIQUE,
                title VARCHAR(255) DEFAULT 'Instant Meeting',
                host_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
                status VARCHAR(20) DEFAULT 'active',
                ended_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS meeting_participants (
                id SERIAL PRIMARY KEY,
                meeting_id INT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE ON UPDATE CASCADE,
                user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
                name VARCHAR(255) NOT NULL,
                joined_at TIMESTAMPTZ DEFAULT NOW(),
                left_at TIMESTAMPTZ
            );
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS meeting_messages (
                id SERIAL PRIMARY KEY,
                meeting_id INT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE ON UPDATE CASCADE,
                sender_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
                sender_name VARCHAR(255) NOT NULL,
                text TEXT NOT NULL,
                timestamp TIMESTAMPTZ DEFAULT NOW()
            );
        `;

        // 2.0: scheduled meetings, real start times and live-caption transcripts
        await sql`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ`;
        await sql`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ`;
        await sql`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS description TEXT`;

        await sql`
            CREATE TABLE IF NOT EXISTS meeting_transcripts (
                id SERIAL PRIMARY KEY,
                meeting_id INT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE ON UPDATE CASCADE,
                speaker_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
                speaker_name VARCHAR(255) NOT NULL,
                text TEXT NOT NULL,
                timestamp TIMESTAMPTZ DEFAULT NOW()
            );
        `;

        // AI recaps, regenerated when new captions or chat arrive (source_count changes)
        await sql`
            CREATE TABLE IF NOT EXISTS meeting_ai_recaps (
                meeting_id INT PRIMARY KEY REFERENCES meetings(id) ON DELETE CASCADE ON UPDATE CASCADE,
                data JSONB NOT NULL,
                provider VARCHAR(20) NOT NULL,
                model VARCHAR(80) NOT NULL,
                source_count INT NOT NULL DEFAULT 0,
                generated_at TIMESTAMPTZ DEFAULT NOW()
            );
        `;

        await sql`CREATE INDEX IF NOT EXISTS idx_meetings_host ON meetings(host_id, created_at DESC)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_participants_meeting ON meeting_participants(meeting_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_participants_user ON meeting_participants(user_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_messages_meeting ON meeting_messages(meeting_id, timestamp)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_transcripts_meeting ON meeting_transcripts(meeting_id, timestamp)`;

    } catch (error) {
        console.error("Error initializing database tables:", error);
        throw error;
    }
}