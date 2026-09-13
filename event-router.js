import app from "./main-worker.js";

const COOKIE = "nexauren_session";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store"
    }
  });
}

function token() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes]
    .map(x => x.toString(16).padStart(2, "0"))
    .join("");
}

function esc(value) {
  return String(value ?? "")
    .replace(/[&<>\"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[char]));
}

function safeUrl(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.href;
  } catch (_) {
    return "";
  }
}

async function user(req, env) {
  const cookie = req.headers.get("Cookie") || "";
  const match = cookie.match(
    new RegExp(`${COOKIE}=([^;]+)`)
  );
  if (!match) return null;

  return env.DB.prepare(
    "SELECT u.id,u.email,u.name,u.role " +
    "FROM sessions s JOIN users u ON u.id=s.user_id " +
    "WHERE s.token=? AND s.expires_at>? LIMIT 1"
  )
    .bind(match[1], Date.now())
    .first();
}

function eventSlug() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes]
    .map(x => x.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 10);
}

function eventHtml(event) {
  const data = JSON.stringify({
    name: event.name,
    description: event.description || "",
    event_date: event.event_date,
    timezone: event.timezone || "UTC",
    image_url: event.image_url || "",
    theme: event.theme || "default",
    link_url: event.link_url || ""
  }).replace(/</g, "\\u003c");

  const image = event.image_url
    ? `<div class="cover" style="background-image:url('${esc(event.image_url)}')"></div>`
    : "";

  return new Response(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${esc(event.description || event.name)}">
<meta name="theme-color" content="#000000">
<title>${esc(event.name)} | Nexauren Event Countdown</title>
<link rel="icon" type="image/png" href="/favicon.png?v=2">
<style>
:root{font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:#030406;color:#f8fafc}
.box{width:min(900px,100%);min-height:390px;display:grid;place-items:center;text-align:center;padding:48px 22px;border:1px solid #30384a;border-radius:28px;background:#0b0e14;box-shadow:0 24px 80px #000;position:relative;overflow:hidden}
.cover{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.16}
.content{position:relative;width:100%;max-width:760px}
.brand{font-size:11px;letter-spacing:.16em;font-weight:900;color:#8db4ff}
.badge{display:inline-block;margin:13px 0;padding:7px 11px;border-radius:999px;background:#111827;color:#8db4ff;font-size:10px;font-weight:900;letter-spacing:.1em}
h1{font-size:clamp(34px,7vw,64px);line-height:1.02;letter-spacing:-.055em;margin:12px 0}
.desc{color:#a8b1c2;font-size:16px;line-height:1.6;max-width:650px;margin:0 auto}
.count{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:30px}
.unit{padding:16px 8px;border:1px solid #30384a;border-radius:16px;background:#151923}
.unit strong{display:block;font-size:clamp(25px,5vw,42px);letter-spacing:-.04em}
.unit small{font-size:9px;color:#7f8aa0;font-weight:900;letter-spacing:.1em}
.done{margin-top:28px;color:#8db4ff;font-weight:850}
.event-link{display:inline-flex;align-items:center;justify-content:center;margin-top:26px;padding:12px 18px;border-radius:12px;background:#8db4ff;color:#05070b;text-decoration:none;font-size:13px;font-weight:900;box-shadow:0 12px 30px #8db4ff22}
@media(max-width:520px){.box{padding:34px 12px}.count{gap:5px}.unit{padding:13px 4px}.unit strong{font-size:22px}.unit small{font-size:8px}}
</style>
</head>
<body>
<main class="box">
${image}
<section class="content">
<div class="brand">NEXAUREN</div>
<span class="badge">EVENT COUNTDOWN</span>
<h1>${esc(event.name)}</h1>
<p class="desc">${esc(event.description || "")}</p>
<div class="count">
<div class="unit"><strong id="d">00</strong><small>DAYS</small></div>
<div class="unit"><strong id="h">00</strong><small>HOURS</small></div>
<div class="unit"><strong id="m">00</strong><small>MINUTES</small></div>
<div class="unit"><strong id="s">00</strong><small>SECONDS</small></div>
</div>
<a id="eventLink" class="event-link" href="#" target="_blank" rel="noopener noreferrer" hidden>Open event link →</a>
<div id="done" class="done" hidden>Event time reached.</div>
</section>
</main>
<script>
const E=${data};
const pad=n=>String(n).padStart(2,"0");
function tick(){
  const diff=new Date(E.event_date).getTime()-Date.now();
  const x=Math.max(0,Math.floor(diff/1000));
  document.getElementById("d").textContent=pad(Math.floor(x/86400));
  document.getElementById("h").textContent=pad(Math.floor(x%86400/3600));
  document.getElementById("m").textContent=pad(Math.floor(x%3600/60));
  document.getElementById("s").textContent=pad(x%60);
  document.getElementById("done").hidden=diff>0;
}
const link=document.getElementById("eventLink");
if(E.link_url){link.href=E.link_url;link.hidden=false;}
tick();
setInterval(tick,1000);
</script>
</body>
</html>`, {
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "public, max-age=60"
    }
  });
}

async function eventsApi(req, env, url) {
  const db = env.TOOLS_DB;
  if (!db) {
    return json({ error: "Tools database is not configured." }, 500);
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const idOrSlug = parts[4] || "";

  if (req.method === "GET" && idOrSlug) {
    const event = await db.prepare(
      "SELECT id,name,description,event_date,timezone,image_url,theme,status,event_slug,link_url,created_at,updated_at " +
      "FROM tool_events WHERE event_slug=? AND status='active' LIMIT 1"
    ).bind(decodeURIComponent(idOrSlug)).first();

    return event
      ? json({ event })
      : json({ error: "Event not found." }, 404);
  }

  const currentUser = await user(req, env);
  if (!currentUser) {
    return json({ error: "Please sign in to manage events." }, 401);
  }

  if (req.method === "GET") {
    const rows = await db.prepare(
      "SELECT id,name,description,event_date,timezone,image_url,theme,status,event_slug,link_url,created_at,updated_at " +
      "FROM tool_events WHERE user_id=? AND tool_slug='event-countdown' " +
      "ORDER BY created_at DESC"
    ).bind(currentUser.id).all();

    return json({ events: rows.results || [] });
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch (_) {
      return json({ error: "Invalid request data." }, 400);
    }

    const name = String(body?.name || "").trim();
    const description = String(body?.description || "").trim();
    const eventDate = String(body?.event_date || "").trim();
    const timezone = String(body?.timezone || "UTC").trim();
    const imageUrl = String(body?.image_url || "").trim();
    const linkUrl = safeUrl(body?.link_url);
    const themes = ["default", "ocean", "sunset", "mint"];
    const theme = themes.includes(body?.theme) ? body.theme : "default";

    if (!name || name.length > 100) {
      return json({
        error: "Event name is required and must be 100 characters or fewer."
      }, 400);
    }
    if (!eventDate || eventDate.length > 80) {
      return json({ error: "A valid event date is required." }, 400);
    }
    if (description.length > 500) {
      return json({
        error: "Description must be 500 characters or fewer."
      }, 400);
    }
    if (imageUrl.length > 1000) {
      return json({ error: "Image URL is too long." }, 400);
    }
    if (String(body?.link_url || "").trim() && !linkUrl) {
      return json({ error: "Please enter a valid http or https link." }, 400);
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const id = token();
      const slug = eventSlug();
      const now = Date.now();

      try {
        await db.prepare(
          "INSERT INTO tool_events(" +
          "id,user_id,tool_slug,event_slug,name,description,event_date,timezone," +
          "image_url,theme,status,link_url,created_at,updated_at" +
          ") VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
        ).bind(
          id,
          currentUser.id,
          "event-countdown",
          slug,
          name,
          description,
          eventDate,
          timezone,
          imageUrl,
          theme,
          "active",
          linkUrl,
          now,
          now
        ).run();

        return json({
          ok: true,
          event_slug: slug,
          url: `${url.origin}/event/${slug}`
        }, 201);
      } catch (error) {
        if (attempt === 4) {
          console.error("Event creation failed:", error);
          return json({
            error: "Unable to create the event. Please try again."
          }, 500);
        }
      }
    }
  }

  if ((req.method === "PUT" || req.method === "DELETE") && idOrSlug) {
    const eventId = decodeURIComponent(idOrSlug);
    const owned = await db.prepare(
      "SELECT id FROM tool_events WHERE id=? AND user_id=? LIMIT 1"
    ).bind(eventId, currentUser.id).first();

    if (!owned) return json({ error: "Event not found." }, 404);

    if (req.method === "DELETE") {
      await db.prepare(
        "DELETE FROM tool_events WHERE id=? AND user_id=?"
      ).bind(eventId, currentUser.id).run();
      return json({ ok: true });
    }

    let body;
    try {
      body = await req.json();
    } catch (_) {
      return json({ error: "Invalid request data." }, 400);
    }

    const name = String(body?.name || "").trim();
    const description = String(body?.description || "").trim();
    const eventDate = String(body?.event_date || "").trim();
    const timezone = String(body?.timezone || "UTC").trim();
    const imageUrl = String(body?.image_url || "").trim();
    const linkUrl = safeUrl(body?.link_url);
    const themes = ["default", "ocean", "sunset", "mint"];
    const theme = themes.includes(body?.theme) ? body.theme : "default";
    const status = body?.status === "paused" ? "paused" : "active";

    if (!name || name.length > 100 || !eventDate) {
      return json({ error: "Event name and date are required." }, 400);
    }
    if (description.length > 500) {
      return json({
        error: "Description must be 500 characters or fewer."
      }, 400);
    }
    if (imageUrl.length > 1000) {
      return json({ error: "Image URL is too long." }, 400);
    }
    if (String(body?.link_url || "").trim() && !linkUrl) {
      return json({ error: "Please enter a valid http or https link." }, 400);
    }

    await db.prepare(
      "UPDATE tool_events SET name=?,description=?,event_date=?,timezone=?," +
      "image_url=?,theme=?,status=?,link_url=?,updated_at=? " +
      "WHERE id=? AND user_id=?"
    ).bind(
      name,
      description,
      eventDate,
      timezone,
      imageUrl,
      theme,
      status,
      linkUrl,
      Date.now(),
      eventId,
      currentUser.id
    ).run();

    return json({ ok: true, status });
  }

  return json({ error: "Method not allowed." }, 405);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);

    if (url.pathname.startsWith("/api/tools/event-countdown/events")) {
      return eventsApi(req, env, url);
    }

    if (url.pathname.startsWith("/event/")) {
      const slug = decodeURIComponent(url.pathname.slice("/event/".length));
      const db = env.TOOLS_DB;
      if (!db || !slug) {
        return new Response("Event not found", { status: 404 });
      }

      const event = await db.prepare(
        "SELECT id,name,description,event_date,timezone,image_url,theme,status,event_slug,link_url " +
        "FROM tool_events WHERE event_slug=? AND status='active' LIMIT 1"
      ).bind(slug).first();

      return event
        ? eventHtml(event)
        : new Response("Event not found", {
            status: 404,
            headers: {
              "Content-Type": "text/plain; charset=UTF-8"
            }
          });
    }

    return app.fetch(req, env, ctx);
  }
};
