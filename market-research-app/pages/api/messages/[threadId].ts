import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import pool from "@/lib/db";
import type { ApiResponse } from "@/lib/types";
import type { Message } from "@/lib/marketplace-types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Message[] | Message>>
) {
  const { threadId } = req.query as { threadId: string };

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ success: false, error: "Authentication required" });
  const userId = (session.user as { id: string }).id;

  // Verify participant
  const { rows: thread } = await pool.query(
    `SELECT id FROM message_threads WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)`,
    [threadId, userId]
  );
  if (!thread[0]) return res.status(403).json({ success: false, error: "Not a participant" });

  if (req.method === "GET")  return handleGet(req, res, threadId, userId);
  if (req.method === "POST") return handleSend(req, res, threadId, userId);
  return res.status(405).json({ success: false, error: "Method not allowed" });
}

// ─── GET /api/messages/[threadId] — fetch messages + mark read ───────────────
async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Message[]>>,
  threadId: string,
  userId: string
) {
  try {
    // Mark incoming messages as read
    await pool.query(
      `UPDATE messages SET read_at = NOW()
       WHERE thread_id = $1 AND sender_id != $2 AND read_at IS NULL`,
      [threadId, userId]
    );

    const { rows } = await pool.query<Message>(
      `SELECT m.*, u.name AS sender_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.thread_id = $1
       ORDER BY m.created_at ASC`,
      [threadId]
    );

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error("[messages/[threadId]] GET error:", err);
    return res.status(500).json({ success: false, error: "Failed to fetch messages" });
  }
}

// ─── POST /api/messages/[threadId] — send a message ─────────────────────────
async function handleSend(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Message>>,
  threadId: string,
  userId: string
) {
  const { content } = req.body as { content: string };
  if (!content?.trim()) return res.status(400).json({ success: false, error: "Message content required" });
  if (content.length > 2000) return res.status(400).json({ success: false, error: "Message too long (max 2000 chars)" });

  try {
    const { rows } = await pool.query<Message>(
      `INSERT INTO messages (thread_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *`,
      [threadId, userId, content.trim()]
    );

    // Update thread's last_message_at
    await pool.query(
      `UPDATE message_threads SET last_message_at = NOW() WHERE id = $1`, [threadId]
    );

    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("[messages/[threadId]] POST error:", err);
    return res.status(500).json({ success: false, error: "Failed to send message" });
  }
}
