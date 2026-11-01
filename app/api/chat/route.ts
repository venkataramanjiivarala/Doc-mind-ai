import { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { embedText } from "@/lib/embeddings";
import { getGroqClient, getGroqModel } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `You are "Chat with PDF", a helpful assistant that answers questions strictly using the provided document excerpts.
Rules:
- Only use information found in the CONTEXT section below.
- If the answer isn't in the context, say you couldn't find that in the document — do not make things up.
- Be concise and clear. Use markdown formatting (lists, bold) when helpful.
- Quote short relevant snippets when useful, but keep answers in your own words overall.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const documentId: string | undefined = body.documentId;
    const question: string = (body.question || "").trim();
    const history: ChatMessage[] = Array.isArray(body.history) ? body.history : [];

    if (!documentId) {
      return new Response(JSON.stringify({ error: "Missing documentId." }), { status: 400 });
    }
    if (!question) {
      return new Response(JSON.stringify({ error: "Missing question." }), { status: 400 });
    }

    const supabase = getSupabaseAdminClient();

    // Confirm the document exists before doing any work.
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id")
      .eq("id", documentId)
      .single();

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: "Document not found." }), { status: 404 });
    }

    // Persist the question right away.
    await supabase.from("messages").insert({
      document_id: documentId,
      role: "user",
      content: question
    });

    // 1. Embed the question
    const queryEmbedding = await embedText(question);

    // 2. Retrieve the most relevant chunks for this document
    const { data: matches, error: matchError } = await supabase.rpc("match_document_chunks", {
      query_embedding: queryEmbedding,
      match_count: 6,
      filter_document_id: documentId
    });

    if (matchError) {
      throw new Error(matchError.message);
    }

    const context = (matches || [])
      .map((m: any, i: number) => `[Excerpt ${i + 1}]\n${m.content}`)
      .join("\n\n");

    const groq = getGroqClient();

    const recentHistory = history.slice(-6).map((m) => ({
      role: m.role,
      content: m.content
    }));

    const stream = await groq.chat.completions.create({
      model: getGroqModel(),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...recentHistory,
        {
          role: "user",
          content: `CONTEXT:\n${context || "(no relevant excerpts found)"}\n\nQUESTION: ${question}`
        }
      ],
      temperature: 0.2,
      stream: true
    });

    const encoder = new TextEncoder();
    let fullAnswer = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const part of stream) {
            const delta = part.choices?.[0]?.delta?.content || "";
            if (delta) {
              fullAnswer += delta;
              controller.enqueue(encoder.encode(delta));
            }
          }
          controller.close();

          // Persist the assistant's full answer once streaming finishes.
          if (fullAnswer.trim()) {
            await supabase.from("messages").insert({
              document_id: documentId,
              role: "assistant",
              content: fullAnswer
            });
          }
        } catch (err) {
          controller.error(err);
        }
      }
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache"
      }
    });
  } catch (err: any) {
    console.error("Chat error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Chat request failed." }), {
      status: 500
    });
  }
}
