import { getAuthenticatedHeaders } from "./api";

export async function generateIntelligenceDraft(payload) {
  try {
    const response = await fetch("/api/ai/newsroom", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthenticatedHeaders()),
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let json = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!response.ok) {
      const message =
        json?.message ||
        `AI Newsroom request failed with status ${response.status}`;
      throw new Error(message);
    }

    if (!json) {
      throw new Error("Respons AI Newsroom tidak valid.");
    }

    return json;
  } catch (error) {
    throw new Error(
      error?.message ||
        "Gagal menghubungi AI Newsroom. Silakan coba lagi nanti.",
    );
  }
}
