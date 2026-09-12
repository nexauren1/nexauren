const promptEl = document.getElementById("prompt");
const styleEl = document.getElementById("style");
const sizeEl = document.getElementById("size");
const button = document.getElementById("generate");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const outputEl = document.getElementById("output");
const downloadEl = document.getElementById("download");
const uploadBox = document.getElementById("uploadBox");
const imageInput = document.getElementById("imageInput");
const previewWrap = document.getElementById("previewWrap");
const preview = document.getElementById("preview");
const removeImage = document.getElementById("removeImage");
const featureButtons = [...document.querySelectorAll(".feature")];
const modeButtons = [...document.querySelectorAll(".mode")];

let mode = "generate";
let selectedImage = null;
let access = { plan: "free", features: {} };

const requiredPlans = {
  "image-editing": "pro",
  variations: "pro",
  "multi-reference": "premium",
  "creative-control": "premium"
};

function planRank(plan) {
  return { free: 0, pro: 1, premium: 2 }[plan] ?? 0;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function featureUnlocked(key) {
  return !!access.features[key];
}

function updateFeatureUI() {
  featureButtons.forEach((el) => {
    const key = el.dataset.feature;
    const unlocked = featureUnlocked(key);
    el.classList.toggle("locked", !unlocked);
    el.classList.toggle("unlocked", unlocked);
  });
}

async function loadAccess() {
  try {
    const response = await fetch("/api/ai/image/access", {
      credentials: "same-origin"
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.ok) {
      access = {
        plan: data.plan || "free",
        features: Object.fromEntries(
          (data.features || []).map((item) => [item.key, !!item.unlocked])
        )
      };
      updateFeatureUI();
    }
  } catch (_) {}
}

function selectMode(nextMode) {
  if (nextMode === "edit" && !featureUnlocked("image-editing")) {
    setStatus("AI Image Editing is a Pro feature. Upgrade to unlock it.");
    window.location.href = "/plans/";
    return;
  }

  mode = nextMode;
  modeButtons.forEach((el) => {
    el.classList.toggle("active", el.dataset.mode === mode);
  });
  uploadBox.classList.toggle("hidden", mode !== "edit");
  button.textContent = mode === "edit" ? "Edit Image" : "Generate Image";
  setStatus("");
}

modeButtons.forEach((el) => {
  el.addEventListener("click", () => selectMode(el.dataset.mode));
});

featureButtons.forEach((el) => {
  el.addEventListener("click", () => {
    const key = el.dataset.feature;
    if (featureUnlocked(key)) {
      if (key === "image-editing") selectMode("edit");
      else setStatus(`${el.querySelector("b").textContent} is available on your plan.`);
      return;
    }
    const required = requiredPlans[key] || "pro";
    setStatus(`${el.querySelector("b").textContent} requires ${required.toUpperCase()}.`);
    window.location.href = "/plans/";
  });
});

imageInput.addEventListener("change", () => {
  const file = imageInput.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setStatus("Please choose a PNG, JPG or WebP image.");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    setStatus("The image must be smaller than 10 MB.");
    imageInput.value = "";
    return;
  }
  selectedImage = file;
  preview.src = URL.createObjectURL(file);
  previewWrap.classList.remove("hidden");
  setStatus("Image ready to edit.");
});

removeImage.addEventListener("click", () => {
  selectedImage = null;
  imageInput.value = "";
  preview.removeAttribute("src");
  previewWrap.classList.add("hidden");
});

function imageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function prepareInputImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.88);
}

function outputSize(size) {
  return {
    square: [1024, 1024],
    portrait: [768, 1024],
    landscape: [1024, 768]
  }[size] || [1024, 1024];
}

async function generateImage() {
  const prompt = promptEl.value.trim();
  if (!prompt) {
    setStatus("Please describe the image you want to create or edit.");
    promptEl.focus();
    return;
  }

  if (mode === "edit") {
    if (!featureUnlocked("image-editing")) {
      window.location.href = "/plans/";
      return;
    }
    if (!selectedImage) {
      setStatus("Upload an image first.");
      return;
    }
  }

  button.disabled = true;
  setStatus(mode === "edit" ? "Editing your image…" : "Generating your image…");
  resultEl.classList.add("hidden");

  try {
    let inputImage = null;
    if (mode === "edit") inputImage = await prepareInputImage(selectedImage);

    const [width, height] = outputSize(sizeEl.value);
    const response = await fetch("/api/ai/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        prompt,
        style: styleEl.value,
        size: sizeEl.value,
        mode,
        input_image: inputImage
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok || !data.image) {
      if (data.code === "UPGRADE_REQUIRED") {
        window.location.href = "/plans/";
        return;
      }
      throw new Error(data.error || "Image generation failed.");
    }

    const src = data.image.startsWith("data:")
      ? data.image
      : `data:image/jpeg;base64,${data.image}`;

    outputEl.src = src;
    downloadEl.href = src;
    resultEl.classList.remove("hidden");
    setStatus(mode === "edit" ? "Image edited successfully." : "Image generated successfully.");
  } catch (error) {
    setStatus(error.message || "Something went wrong.");
  } finally {
    button.disabled = false;
  }
}

button.addEventListener("click", generateImage);
loadAccess();
