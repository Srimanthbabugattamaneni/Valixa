import type { NextApiRequest, NextApiResponse } from "next";
import type { ApiResponse } from "@/lib/types";

const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL ?? "http://localhost:8000";
const AI_SERVICE_API_KEY = process.env.AI_SERVICE_API_KEY ?? "";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ optimized: string }>>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { brief, businessType } = req.body as { brief?: string; businessType?: string };

  if (!brief || brief.trim().length < 5) {
    return res.status(400).json({ success: false, error: "Please write at least a sentence first." });
  }

  try {
    const upstream = await fetch(`${FASTAPI_BASE_URL}/api/v1/optimize-brief`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": AI_SERVICE_API_KEY,
      },
      body: JSON.stringify({
        brief: brief.trim(),
        business_type: businessType ?? "",
      }),
    });

    const data = await upstream.json() as { optimized?: string; detail?: string };

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        success: false,
        error: data.detail ?? "AI optimization failed.",
      });
    }

    if (!data.optimized) {
      return res.status(502).json({ success: false, error: "No response from AI." });
    }

    return res.status(200).json({ success: true, data: { optimized: data.optimized } });
  } catch (err) {
    console.error("optimize-brief proxy error:", err);
    return res.status(500).json({ success: false, error: "Could not reach AI service." });
  }
}
