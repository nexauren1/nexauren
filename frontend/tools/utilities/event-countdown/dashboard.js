const root = document.querySelector("#events");
const message = document.querySelector("#message");
const count = document.querySelector("#eventCount");
const modal = document.querySelector("#editModal");
const form = document.querySelector("#editForm");
const editMessage = document.querySelector("#editMessage");
let events = [];
let editingId = null;

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
}[char]));

const fmt = value => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

const zones = () => [...new Set([
  "UTC",
  Intl.DateTimeFormat().resolvedOptions().timeZone,
  "Europe/Lisbon",
  "Africa/Maputo",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Tokyo"
].filter(Boolean))];

function fillZones() {
  const select = document.querySelector("#editTimezone");
  zones().forEach(zone => {
    const option = document.createElement("option");
    option.value = zone;
    option.textContent = zone;
    select.appendChild(option);
  });
}

function embedCode(url, name) {
  const title = String(name || "Nexauren Event Countdown")
    .replace(/"/g, "&quot;");
  return `<iframe src="${url}" width="100%" height="300" frameborder="0" loading="lazy" title="${title}"></iframe>`;
}

function render() {
  count.textContent = events.length;

  if (!events.length) {
    root.innerHTML = `
      <div class="empty">
        <div class="empty-icon">◷</div>
        <h2>No events yet</h2>
        <p>Create your first countdown and share it with your audience.</p>
        <a class="primary" href="index.html">Create your first event →</a>
      </div>`;
    return;
  }

  root.innerHTML = events.map(event => {
    const url = `${location.origin}/event/${encodeURIComponent(event.event_slug)}`;
    const paused = event.status !== "active";
    return `
      <article class="event ${paused ? "is-paused" : ""}">
        <div class="event-top">
          <div class="badges">
            <span class="badge ${paused ? "paused" : "active"}">
              ${paused ? "PAUSED" : "ACTIVE"}
            </span>
            <span class="badge">${esc(event.theme || "default")}</span>
          </div>
          <span class="event-id">#${esc(event.event_slug)}</span>
        </div>
        <h2>${esc(event.name)}</h2>
        <p>${esc(event.description || "No description")}</p>
        <div class="date">
          <span>EVENT DATE</span>
          <strong>${esc(fmt(event.event_date))}</strong>
          <small>${esc(event.timezone || "UTC")}</small>
        </div>
        <div class="actions">
          <a href="${url}" target="_blank" rel="noopener">Preview</a>
          <button data-copy="${esc(url)}">Copy Link</button>
          <button data-embed="${esc(url)}" data-name="${esc(event.name)}">Embed</button>
          <button data-edit="${esc(event.id)}">Edit</button>
          <button class="toggle" data-toggle="${esc(event.id)}">
            ${paused ? "Activate" : "Pause"}
          </button>
          <button class="delete" data-delete="${esc(event.id)}">Delete</button>
        </div>
      </article>`;
  }).join("");
}

async function load() {
  try {
    const response = await fetch(
      "/api/tools/event-countdown/events",
      {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      }
    );
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      location.href =
        "/login?next=/tools/utilities/event-countdown/dashboard.html";
      return;
    }

    if (!response.ok) {
      throw Error(data.error || "Unable to load events.");
    }

    events = data.events || [];
    render();
  } catch (error) {
    message.textContent = error.message;
    root.innerHTML = "";
  }
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {})
    },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || "Request failed.");
  return data;
}

function openEdit(event) {
  editingId = event.id;
  document.querySelector("#editName").value = event.name || "";
  document.querySelector("#editDescription").value = event.description || "";
  document.querySelector("#editDate").value = event.event_date || "";
  document.querySelector("#editTimezone").value = event.timezone || "UTC";
  document.querySelector("#editTheme").value = event.theme || "default";
  document.querySelector("#editImage").value = event.image_url || "";
  editMessage.textContent = "";
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.querySelector("#editName").focus();
}

function closeEdit() {
  editingId = null;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

async function saveEdit(event) {
  event.preventDefault();
  if (!editingId) return;

  const button = form.querySelector(".save");
  button.disabled = true;
  button.textContent = "Saving…";
  editMessage.textContent = "";

  try {
    await api(
      `/api/tools/event-countdown/events/${encodeURIComponent(editingId)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          name: document.querySelector("#editName").value.trim(),
          description: document.querySelector("#editDescription").value.trim(),
          event_date: document.querySelector("#editDate").value,
          timezone: document.querySelector("#editTimezone").value,
          theme: document.querySelector("#editTheme").value,
          image_url: document.querySelector("#editImage").value.trim()
        })
      }
    );

    closeEdit();
    await load();
  } catch (error) {
    editMessage.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Save changes";
  }
}

document.addEventListener("click", async event => {
  const copy = event.target.closest("[data-copy]");
  if (copy) {
    try {
      await navigator.clipboard.writeText(copy.dataset.copy);
      const old = copy.textContent;
      copy.textContent = "Copied";
      setTimeout(() => copy.textContent = old, 1200);
    } catch (_) {}
    return;
  }

  const embed = event.target.closest("[data-embed]");
  if (embed) {
    const code = embedCode(embed.dataset.embed, embed.dataset.name);
    try {
      await navigator.clipboard.writeText(code);
      const old = embed.textContent;
      embed.textContent = "Copied";
      setTimeout(() => embed.textContent = old, 1200);
    } catch (_) {}
    return;
  }

  const edit = event.target.closest("[data-edit]");
  if (edit) {
    const item = events.find(value => value.id === edit.dataset.edit);
    if (item) openEdit(item);
    return;
  }

  const toggle = event.target.closest("[data-toggle]");
  if (toggle) {
    const item = events.find(value => value.id === toggle.dataset.toggle);
    if (!item) return;
    toggle.disabled = true;
    try {
      await api(
        `/api/tools/event-countdown/events/${encodeURIComponent(item.id)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: item.name,
            description: item.description || "",
            event_date: item.event_date,
            timezone: item.timezone || "UTC",
            theme: item.theme || "default",
            image_url: item.image_url || "",
            status: item.status === "active" ? "paused" : "active"
          })
        }
      );
      await load();
    } catch (error) {
      message.textContent = error.message;
      toggle.disabled = false;
    }
    return;
  }

  const del = event.target.closest("[data-delete]");
  if (del) {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    del.disabled = true;
    try {
      await api(
        `/api/tools/event-countdown/events/${encodeURIComponent(del.dataset.delete)}`,
        { method: "DELETE" }
      );
      events = events.filter(item => item.id !== del.dataset.delete);
      render();
    } catch (error) {
      message.textContent = error.message;
      del.disabled = false;
    }
  }
});

document.addEventListener("click", event => {
  if (event.target.closest("[data-close]") || event.target === modal) {
    closeEdit();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && modal.classList.contains("open")) {
    closeEdit();
  }
});

form.addEventListener("submit", saveEdit);
fillZones();
load();
