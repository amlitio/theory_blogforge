import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 3000;
const MAX_TOOL_ROUNDS = 8; // prevent infinite loops

interface ContentBlock {
  type: string;
  id?: string;
  name?: string;
  input?: unknown;
  text?: string;
  tool_use_id?: string;
  content?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

interface AnthropicResponse {
  type: string;
  stop_reason: string;
  content: ContentBlock[];
  error?: { message: string };
}

async function anthropicCall(
  messages: Message[],
  useSearch: boolean,
  apiKey: string
): Promise<AnthropicResponse> {
  const body: Record<string, unknown> = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages,
  };

  if (useSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  }

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errText}`);
  }

  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, useSearch } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured in Vercel environment variables" }, { status: 500 });
    }

    // Build the conversation — start with the user prompt
    const messages: Message[] = [{ role: "user", content: prompt }];

    let response = await anthropicCall(messages, useSearch, apiKey);

    if (response.type === "error") {
      throw new Error(response.error?.message || "Unknown API error");
    }

    // ── Multi-turn tool loop ─────────────────────────────────────────────
    // When the model calls web_search, stop_reason is "tool_use".
    // We must append the assistant turn + tool results, then call again.
    let rounds = 0;

    while (response.stop_reason === "tool_use" && rounds < MAX_TOOL_ROUNDS) {
      rounds++;

      // Collect all tool_use blocks from this response
      const toolUseBlocks = response.content.filter(b => b.type === "tool_use");

      if (toolUseBlocks.length === 0) break;

      // Append the assistant's response (with tool_use blocks) to history
      messages.push({ role: "assistant", content: response.content });

      // Build tool_result blocks — Anthropic handles actual search execution;
      // we just need to return an empty/acknowledgement result to continue.
      // The web_search tool is a "server-side" tool — results come back in
      // the next response automatically when we send tool_result blocks.
      const toolResults: ContentBlock[] = toolUseBlocks.map(block => ({
        type: "tool_result",
        tool_use_id: block.id!,
        content: "", // empty — Anthropic fills search results on their side
      }));

      messages.push({ role: "user", content: toolResults });

      // Call again with updated history
      response = await anthropicCall(messages, useSearch, apiKey);

      if (response.type === "error") {
        throw new Error(response.error?.message || "API error during tool loop");
      }
    }

    // ── Extract final text ───────────────────────────────────────────────
    const text = (response.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text || "")
      .join("\n")
      .trim();

    if (!text) {
      return NextResponse.json(
        { error: `Agent returned no text after ${rounds} tool rounds. stop_reason: ${response.stop_reason}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ text, toolRounds: rounds });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
