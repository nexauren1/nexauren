const promptEl = document.getElementById("prompt");
const styleEl = document.getElementById("style");
const sizeEl = document.getElementById("size");
const button = document.getElementById("generate");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const outputEl = document.getElementById("output");
const downloadEl = document.getElementById("download");

button.addEventListener("click", generateImage);

async function generateImage() {
  const prompt = promptEl.value.trim();
  if (!prompt) {
    statusEl.textContent = "Please describe the image you want to create.";
    promptEl.focus();
    return;
  }

  button.disabled = true;
  statusEl.textContent = "Generating your image…";
  resultEl.classList.add("hidden");

  try {
    const response = await fetch("/api/ai/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        prompt,
        style: styleEl.value,
        size: sizeEl.value
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok || !data.image) {
      throw new Error(data.error || "Image generation failed.");
    }

    const src = data.image.startsWith("data:")
      ? data.image
      : `data:image/jpeg;base64,${data.image}`;

    outputEl.src = src;
    downloadEl.href = src;
    resultEl.classList.remove("hidden");
    statusEl.textContent = "Image generated successfully.";
  } catch (error) {
    statusEl.textContent = error.message || "Something went wrong.";
  } finally {
    button.disabled = false;
  }
}
