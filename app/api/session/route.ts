import { NextResponse } from "next/server";

// SDP proxy: keeps OPENAI_API_KEY on the server.
// Browser sends WebRTC offer SDP; server forwards to OpenAI Realtime and
// returns the answer SDP.
export async function POST(req: Request) {
  try {
    const sdpOffer = await req.text();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 500 }
      );
    }

    const res = await fetch(
      "https://api.openai.com/v1/realtime/calls?model=gpt-realtime-2",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/sdp",
        },
        body: sdpOffer,
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const sdpAnswer = await res.text();
    return new Response(sdpAnswer, {
      headers: { "Content-Type": "application/sdp" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to establish realtime session.",
      },
      { status: 500 }
    );
  }
}
