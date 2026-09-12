import samplePackApp from "./sample-pack-worker.js";
import { handleAIImage } from "./ai-image-worker.js";

export default {
  async fetch(req, env, ctx) {
    const imageResponse = await handleAIImage(req, env);
    if (imageResponse) return imageResponse;
    return samplePackApp.fetch(req, env, ctx);
  }
};
