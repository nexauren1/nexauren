import samplePackApp from "./sample-pack-worker.js";
import { handleAIImage } from "./ai-image-worker.js";
import { handlePdfSummarizer } from "./pdf-summarizer-worker.js";

export default {
  async fetch(req, env, ctx) {
    const pdfResponse = await handlePdfSummarizer(req, env);
    if (pdfResponse) return pdfResponse;

    const imageResponse = await handleAIImage(req, env);
    if (imageResponse) return imageResponse;

    return samplePackApp.fetch(req, env, ctx);
  }
};
