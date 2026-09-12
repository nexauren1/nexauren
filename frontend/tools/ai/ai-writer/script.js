(() => {
  const $ = id => document.getElementById(id);
  const prompt = $("prompt");
  const result = $("result");
  const status = $("status");
  const generateButton = $("generateButton");
  const resultPanel = $("resultPanel");
  let mode = "write";
  let feature = "";

  document.querySelectorAll(".mode").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".mode").forEach(item =>
        item.classList.remove("active")
      );
      button.classList.add("active");
      mode = button.dataset.mode;
      prompt.placeholder = placeholderFor(mode);
    });
  });

  document.querySelectorAll(".feature-card").forEach(button => {
    button.addEventListener("click", () => {
      feature = button.dataset.feature || "";
      document.querySelectorAll(".feature-card").forEach(item =>
        item.classList.remove("selected")
      );
      button.classList.add("selected");
      setStatus(`${button.dataset.plan === "premium" ? "Premium" : "Pro"} feature selected. Click Generate to continue.`);
    });
  });

  $("clearButton").addEventListener("click", () => {
    prompt.value = "";
    result.value = "";
    resultPanel.classList.add("hidden");
    feature = "";
    document.querySelectorAll(".feature-card").forEach(item =>
      item.classList.remove("selected")
    );
    setStatus("");
  });

  $("copyButton").addEventListener("click", async () => {
    if (!result.value) return;
    await navigator.clipboard.writeText(result.value);
    setStatus("Copied to clipboard.", "success");
  });

  generateButton.addEventListener("click", generate);

  async function generate() {
    const text = prompt.value.trim();
    if (!text) {
      setStatus("Enter a topic or text first.", "error");
      prompt.focus();
      return;
    }

    generateButton.disabled = true;
    setStatus("AI is writing…");

    if (window.NexaurenLoader) {
      NexaurenLoader.showProcessing("Nexauren AI is working…");
    }

    try {
      const response = await fetch("/api/tools/ai-writer", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          prompt: text,
          tone: $("tone").value,
          length: $("length").value,
          feature
        })
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 403 && data.upgrade) {
        showUpgrade(data.required_plan, data.feature_name);
        return;
      }

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "The AI Writer could not complete the request.");
      }

      result.value = data.text || "";
      resultPanel.classList.remove("hidden");
      setStatus("Done.", "success");
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Something went wrong.", "error");
    } finally {
      generateButton.disabled = false;
      if (window.NexaurenLoader) {
        NexaurenLoader.hideProcessing(120);
      }
    }
  }

  function showUpgrade(plan, featureName) {
    const label = plan === "premium" ? "Premium" : "Pro";
    const message = `${featureName || "This feature"} requires ${label}.`;
    setStatus(message, "error");

    if (window.confirm(`${message}\n\nUpgrade your plan to unlock it?`)) {
      window.location.href = "/plans/";
    }
  }

  function placeholderFor(value) {
    if (value === "rewrite") {
      return "Paste the text you want Nexauren to rewrite…";
    }
    if (value === "improve") {
      return "Paste the text you want Nexauren to improve…";
    }
    if (value === "summarize") {
      return "Paste the text you want Nexauren to summarize…";
    }
    return "Example: Write a short product description for a modern productivity app.";
  }

  function setStatus(message, type = "") {
    status.textContent = message;
    status.className = `status ${type}`.trim();
  }
})();
