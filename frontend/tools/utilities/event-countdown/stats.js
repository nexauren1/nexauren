const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const eventId = params.get("event");

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[char]));
}

function fail(message) {
  $("loading").hidden = true;
  $("error").textContent = message;
  $("error").hidden = false;
}

function renderChart(days) {
  const chart = $("chart");
  if (!days.length) {
    chart.innerHTML = `<div class="chart-empty">No activity yet. Share your event to start collecting data.</div>`;
    return;
  }

  const ordered = [...days].sort((a,b) => a.day.localeCompare(b.day));
  const max = Math.max(1, ...ordered.map(x => Number(x.views || 0)));
  chart.innerHTML = ordered.map(item => {
    const height = Math.max(5, Number(item.views || 0) / max * 100);
    const clicks = Math.min(100, Number(item.link_clicks || 0) / max * 100);
    return `<div class="bar-group" title="${esc(item.day)} · ${Number(item.views||0)} views · ${Number(item.link_clicks||0)} clicks">
      <div class="bar views" style="height:${height}%"></div>
      <div class="bar clicks" style="height:${Math.max(3,clicks)}%"></div>
      <span>${esc(item.day.slice(5))}</span>
    </div>`;
  }).join("");
}

async function load() {
  if (!eventId) return fail("No event was selected.");
  try {
    const response = await fetch(`/api/tools/event-countdown/events/${encodeURIComponent(eventId)}/stats`, {
      credentials:"same-origin", headers:{Accept:"application/json"}
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
      return;
    }
    if (!response.ok) throw Error(data.error || "Unable to load statistics.");

    const eventsResponse = await fetch("/api/tools/event-countdown/events", {credentials:"same-origin",headers:{Accept:"application/json"}});
    const eventsData = await eventsResponse.json().catch(() => ({}));
    const event = (eventsData.events || []).find(item => item.id === eventId);
    if (!event) throw Error("Event not found.");

    const views = Number(data.views || 0);
    const clicks = Number(data.link_clicks || 0);
    const days = data.days || [];
    const rate = views ? Math.round(clicks / views * 1000) / 10 : 0;

    $("eventName").textContent = event.name;
    $("views").textContent = views.toLocaleString();
    $("clicks").textContent = clicks.toLocaleString();
    $("days").textContent = days.length.toLocaleString();
    $("rate").textContent = `${rate}%`;
    $("preview").href = `/event/${encodeURIComponent(event.event_slug)}`;
    $("updated").textContent = "Live data";

    const ordered = [...days].sort((a,b) => b.day.localeCompare(a.day));
    $("rows").innerHTML = ordered.map(item => `<tr><td>${esc(new Date(`${item.day}T00:00:00`).toLocaleDateString(undefined,{dateStyle:"medium"}))}</td><td>${Number(item.views||0).toLocaleString()}</td><td>${Number(item.link_clicks||0).toLocaleString()}</td></tr>`).join("");
    $("empty").hidden = ordered.length > 0;
    renderChart(days);
    $("loading").hidden = true;
    $("app").hidden = false;
  } catch (error) {
    fail(error.message);
  }
}
load();
