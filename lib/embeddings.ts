import { pipeline, env } from "@xenova/transformers";

// Run fully offline-capable, cache models in /tmp which is writable
// on Vercel serverless functions.
env.cacheDir = "/tmp/transformers-cache";
env.allowLocalModels = false;

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2"; // 384-dim embeddings

type FeatureExtractionPipeline = any;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", MODEL_NAME);
  }
  return extractorPromise;
}

/**
 * Embed a single string into a 384-dim vector.
 */
export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

/**
 * Embed many strings sequentially (kept simple/predictable for
 * serverless memory limits). Batches could be added later.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const extractor = await getExtractor();
  const results: number[][] = [];
  for (const text of texts) {
    const output = await extractor(text, { pooling: "mean", normalize: true });
    results.push(Array.from(output.data as Float32Array));
  }
  return results;
}
