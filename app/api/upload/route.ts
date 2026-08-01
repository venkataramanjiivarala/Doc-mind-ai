import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { chunkText } from "@/lib/chunk";
import { embedTexts } from "@/lib/embeddings";

// pdf-parse and @xenova/transformers need the full Node.js runtime.
export const runtime = "nodejs";
// Parsing + embedding a PDF can take a while on serverless cold starts.
export const maxDuration = 60;

const MAX_SIZE_MB = Number(process.env.MAX_PDF_SIZE_MB || 15);

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdminClient();
  let documentId: string | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No PDF file was uploaded. Use form field name 'file'." },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
    }

    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_SIZE_MB) {
      return NextResponse.json(
        { error: `File too large. Max size is ${MAX_SIZE_MB}MB.` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Dynamic import avoids pdf-parse's debug-mode file access on module load.
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(buffer);

    const text = (parsed.text || "").trim();
    if (!text) {
      return NextResponse.json(
        { error: "Couldn't extract any text from this PDF (it may be scanned/image-only)." },
        { status: 422 }
      );
    }

    // 1. Create the document row
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .insert({
        file_name: file.name,
        page_count: parsed.numpages ?? null,
        status: "processing"
      })
      .select()
      .single();

    if (docError || !doc) {
      throw new Error(docError?.message || "Failed to create document record.");
    }
    documentId = doc.id;

    // 2. Chunk the extracted text
    const chunks = chunkText(text, 1000, 150);
    if (chunks.length === 0) {
      throw new Error("Text extracted but produced no usable chunks.");
    }

    // 3. Embed each chunk (local model, no external API key needed)
    const embeddings = await embedTexts(chunks);

    // 4. Insert chunks + embeddings
    const rows = chunks.map((content, i) => ({
      document_id: documentId,
      chunk_index: i,
      content,
      embedding: embeddings[i]
    }));

    // Insert in batches to keep request payloads reasonable
    const BATCH_SIZE = 50;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error: chunkError } = await supabase.from("document_chunks").insert(batch);
      if (chunkError) throw new Error(chunkError.message);
    }

    // 5. Mark document as ready
    await supabase.from("documents").update({ status: "ready" }).eq("id", documentId);

    return NextResponse.json({
      documentId,
      fileName: file.name,
      pageCount: parsed.numpages ?? null,
      chunkCount: chunks.length
    });
  } catch (err: any) {
    console.error("Upload error:", err);

    if (documentId) {
      await supabase
        .from("documents")
        .update({ status: "error", error_message: String(err?.message || err) })
        .eq("id", documentId);
    }

    return NextResponse.json(
      { error: err?.message || "Something went wrong while processing the PDF." },
      { status: 500 }
    );
  }
}
