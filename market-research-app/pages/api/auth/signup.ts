import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";
import type { ApiResponse } from "@/lib/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ userId: string }>>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: "Email and password are required",
      code: "MISSING_FIELDS",
    });
  }

  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({
      success: false,
      error: "Password must be at least 8 characters",
      code: "WEAK_PASSWORD",
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (email, name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [email.toLowerCase().trim(), name?.trim() || null, passwordHash]
    );

    return res.status(201).json({ success: true, data: { userId: rows[0].id } });
  } catch (err: unknown) {
    // Unique constraint violation — email already registered
    if ((err as { code?: string }).code === "23505") {
      return res.status(409).json({
        success: false,
        error: "An account with this email already exists",
        code: "EMAIL_EXISTS",
      });
    }
    console.error("[/api/auth/signup]", err);
    return res.status(500).json({
      success: false,
      error: "Failed to create account. Please try again.",
      code: "INTERNAL_ERROR",
    });
  }
}
