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
  return [...bytes].map(x => x.toString(16).padStart(2, "0")).join("");
}

function esc(value) {
  return String(value ?? "").replace(/[&<>\"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    "\"": "&quot;", "'": "&#39;"
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
  const match = cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
  if (!match) return null;
  return env.DB.prepare(
    "SELECT u.id,u.email,u.name,u.role " +
    "FROM sessions s JOIN users u ON u.id=s.user_id " +
    "WHERE s.token=? AND s.expires_at>? LIMIT 1"
  ).bind(match[1], Date.now()).first();
}

function eventSlug() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map(x => x.toString(36).padStart(2, "0")).join("").slice(0, 10);
}

function statsDay() {
  return new Date().toISOString().slice(0, 10);
}

async function trackEvent(env, eventId, field) {
  const db = env.TOOLS_DB;
  if (!db || !eventId || !["views", "link_clicks"].includes(field)) return;
  const day = statsDay();
  await db.prepare(
    "INSERT INTO event_stats(event_id,day,views,link_clicks) VALUES(?,?,?,?) " +
    "ON CONFLICT(event_id,day) DO UPDATE SET " +
    `${field}=${field}+1`
  ).bind(eventId, day, field === "views" ? 1 : 0, field === "link_clicks" ? 1 : 0).run();
}

async function eventStats(req, env, eventId) {
  const currentUser = await user(req, env);
  if (!currentUser) return json({ error: "Please sign in to view statistics." }, 401);

  const owned = await env.TOOLS_DB.prepare(
    "SELECT id FROM tool_events WHERE id=? AND user_id=? LIMIT 1"
  ).bind(eventId, currentUser.id).first();
  if (!owned) return json({ error: "Event not found." }, 404);

  const totals = await env.TOOLS_DB.prepare(
    "SELECT COALESCE(SUM(views),0) AS views, COALESCE(SUM(link_clicks),0) AS link_clicks " +
    "FROM event_stats WHERE event_id=?"
  ).bind(eventId).first();

  const daily = await env.TOOLS_DB.prepare(
    "SELECT day,views,link_clicks FROM event_stats WHERE event_id=? " +
    "ORDER BY day DESC LIMIT 90"
  ).bind(eventId).all();

  return json({
    views: Number(totals?.views || 0),
    link_clicks: Number(totals?.link_clicks || 0),
    days: daily.results || []
  });
}

function eventHtml(event) {
  const theme = [
    "default", "conference", "wedding", "birthday", "sale",
    "launch", "webinar", "survey", "ocean", "sunset", "mint"
  ].includes(event.theme) ? event.theme : "default";

  const data = JSON.stringify({
    id: event.id,
    slug: event.event_slug,
    name: event.name,
    description: event.description || "",
    event_date: event.event_date,
    timezone: event.timezone || "UTC",
    image_url: event.image_url || "",
    theme,
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
<meta name="theme-color" content="#030406">
<title>${esc(event.name)} | Nexauren Event Countdown</title>
<link rel="icon" type="image/png" href="/favicon.png?v=2">
<style>
:root{font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:#030406;color:#f8fafc;overflow-x:hidden}
.box{--accent:#8db4ff;--card:#151923;--border:#30384a;width:min(900px,100%);min-height:410px;display:grid;place-items:center;text-align:center;padding:48px 22px;border:1px solid var(--border);border-radius:28px;background:#0b0e14;box-shadow:0 24px 80px #000;position:relative;overflow:hidden}
.cover{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.14}
.box:before,.box:after{content:"";position:absolute;pointer-events:none}
.content{position:relative;width:100%;max-width:760px;z-index:2}
.brand{font-size:11px;letter-spacing:.16em;font-weight:900;color:var(--accent)}
.badge{display:inline-block;margin:13px 0;padding:7px 11px;border-radius:999px;background:var(--card);border:1px solid var(--border);color:var(--accent);font-size:10px;font-weight:900;letter-spacing:.1em}
h1{font-size:clamp(34px,7vw,64px);line-height:1.02;letter-spacing:-.055em;margin:12px 0}
.desc{color:#a8b1c2;font-size:16px;line-height:1.6;max-width:650px;margin:0 auto}
.count{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:30px;position:relative;z-index:2}
.unit{padding:16px 8px;border:1px solid var(--border);border-radius:16px;background:var(--card);box-shadow:0 12px 30px #0003}
.unit strong{display:block;font-size:clamp(25px,5vw,42px);letter-spacing:-.04em;color:#fff}
.unit small{font-size:9px;color:#7f8aa0;font-weight:900;letter-spacing:.1em}
.done{margin-top:28px;color:var(--accent);font-weight:850}
.event-link{display:inline-flex;align-items:center;justify-content:center;margin-top:26px;padding:12px 18px;border-radius:12px;background:var(--accent);color:#05070b;text-decoration:none;font-size:13px;font-weight:900;box-shadow:0 12px 30px #0005;position:relative;z-index:3}
.theme-conference{--accent:#a78bfa;--card:#17112b;--border:#5b21b6}
.theme-conference:before{inset:-40%;background:linear-gradient(90deg,transparent 49.5%,#a78bfa18 50%,transparent 50.5%),linear-gradient(0deg,transparent 49.5%,#a78bfa18 50%,transparent 50.5%);background-size:42px 42px;transform:perspective(500px) rotateX(58deg) translateY(28%);opacity:.7}
.theme-conference:after{width:280px;height:280px;top:-130px;right:-100px;border-radius:50%;background:#a78bfa22;box-shadow:0 0 100px #a78bfa33}
.theme-wedding{--accent:#f9a8d4;--card:#2b1724;--border:#9d174d}
.theme-wedding:before{width:230px;height:230px;left:-90px;top:-90px;border:2px solid #f9a8d433;border-radius:50%;box-shadow:80px 80px 0 -2px #f9a8d422,160px 160px 0 -2px #f9a8d411}
.theme-wedding:after{width:170px;height:170px;right:-65px;bottom:-70px;border:2px solid #f9a8d433;border-radius:50%;transform:rotate(25deg)}
.theme-birthday{--accent:#facc15;--card:#29200b;--border:#a16207}
.theme-birthday:before{inset:0;background:radial-gradient(circle at 10% 15%,#facc1544 0 5px,transparent 6px),radial-gradient(circle at 25% 80%,#fb718544 0 5px,transparent 6px),radial-gradient(circle at 78% 18%,#67e8f944 0 5px,transparent 6px),radial-gradient(circle at 90% 75%,#c084fc44 0 5px,transparent 6px),radial-gradient(circle at 45% 8%,#fb718544 0 4px,transparent 5px);background-size:130px 120px}
.theme-birthday:after{width:120px;height:150px;right:18px;top:-65px;border-radius:50% 50% 45% 45%;background:#facc1520;border:1px solid #facc1544;box-shadow:-55px 20px 0 -18px #fb718522,55px 35px 0 -18px #67e8f922}
.theme-sale{--accent:#fb7185;--card:#2b0b12;--border:#be123c}
.theme-sale:before{width:380px;height:380px;right:-170px;top:-170px;background:repeating-conic-gradient(from 0deg,#fb71851c 0 8deg,transparent 8deg 18deg);border-radius:50%}
.theme-sale:after{width:90px;height:90px;left:24px;top:24px;border-radius:50%;background:#fb71851c;border:1px dashed #fb718577;box-shadow:0 0 0 12px #fb718508}
.theme-launch{--accent:#38bdf8;--card:#071b2d;--border:#0369a1}
.theme-launch:before{width:520px;height:180px;border:1px solid #38bdf822;border-radius:50%;transform:rotate(-22deg);box-shadow:0 0 0 28px #38bdf20a,0 0 80px #38bdf218}
.theme-launch:after{width:10px;height:10px;border-radius:50%;background:#38bdf8;right:23%;top:25%;box-shadow:0 0 24px 8px #38bdf855}
.theme-webinar{--accent:#c4b5fd;--card:#19152e;--border:#6d28d9}
.theme-webinar:before{width:270px;height:165px;left:-55px;bottom:-55px;border:1px solid #c4b5fd33;border-radius:18px;transform:rotate(-8deg);box-shadow:inset 0 0 0 12px #c4b5fd08}
.theme-webinar:after{width:210px;height:125px;right:-35px;top:-35px;border:1px solid #c4b5fd33;border-radius:16px;transform:rotate(8deg);box-shadow:inset 0 0 0 10px #c4b5fd08}
.theme-survey{--accent:#5eead4;--card:#092522;--border:#0f766e}
.theme-survey:before{inset:30px;border:1px dashed #5eead422;border-radius:20px;background:repeating-linear-gradient(0deg,transparent 0 34px,#5eead40a 35px 36px)}
.theme-survey:after{width:115px;height:115px;right:34px;top:25px;border:2px solid #5eead433;border-radius:16px;box-shadow:inset 24px 0 0 -22px #5eead422}
.theme-ocean{--accent:#67e8f9;--card:#07334b;--border:#155e75}
.theme-ocean:before{left:-10%;right:-10%;bottom:-90px;height:190px;background:radial-gradient(ellipse at 20% 50%,#67e8f922 0 38%,transparent 39%),radial-gradient(ellipse at 70% 60%,#67e8f916 0 42%,transparent 43%);border-radius:50%}
.theme-ocean:after{width:180px;height:180px;right:-75px;top:-75px;border-radius:50%;border:1px solid #67e8f933;box-shadow:0 0 70px #67e8f922}
.theme-sunset{--accent:#fdba74;--card:#401a20;--border:#7c2d12}
.theme-sunset:before{width:230px;height:230px;right:-70px;bottom:-95px;border-radius:50%;background:#fdba7422;box-shadow:0 0 80px #fdba7433}
.theme-sunset:after{left:0;right:0;bottom:0;height:90px;background:linear-gradient(180deg,transparent,#fdba7409)}
.theme-mint{--accent:#86efac;--card:#103b2d;--border:#166534}
.theme-mint:before{width:160px;height:250px;left:-30px;bottom:-70px;border-radius:100% 0 100% 0;background:#86efac10;transform:rotate(-24deg);border:1px solid #86efac22}
.theme-mint:after{width:130px;height:200px;right:-35px;top:-55px;border-radius:0 100% 0 100%;background:#86efac0d;transform:rotate(22deg);border:1px solid #86efac1c}
@media(max-width:520px){.box{padding:34px 12px}.count{gap:5px}.unit{padding:13px 4px}.unit strong{font-size:22px}.unit small{font-size:8px}.theme-survey:before{inset:14px}}
</style>
</head>
<body>
<main class="box theme-${theme}">
${image}
<section class="content">
<div class="brand">NEXAUREN</div>
<span class="badge">EVENT COUNTDOWN</span>
<h1>${esc(event.name)}</h1>
<p class="desc">${esc(event.description || "")}</p>
<div class="count"><div class="unit"><strong id="d">00</strong><small>DAYS</small></div><div class="unit"><strong id="h">00</strong><small>HOURS</small></div><div class="unit"><strong id="m">00</strong><small>MINUTES</small></div><div class="unit"><strong id="s">00</strong><small>SECONDS</small></div></div>
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
  if(diff<=0) document.getElementById("done").hidden=false;
}
if(E.link_url){
  const a=document.getElementById("eventLink");
  a.href=E.link_url;
  a.hidden=false;
  a.addEventListener("click",()=>fetch("/api/tools/event-countdown/events/"+encodeURIComponent(E.id)+"/stats/click",{method:"POST",keepalive:true}).catch(()=>{}));
}
fetch("/api/tools/event-countdown/events/"+encodeURIComponent(E.id)+"/stats/view",{method:"POST",keepalive:true}).catch(()=>{});
tick();setInterval(tick,1000);
</script>
</body></html>`, { headers:{ "Content-Type":"text/html; charset=UTF-8", "Cache-Control":"public, max-age=60" } });
}

async function eventsApi(req, env, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  const idOrSlug = parts[parts.length - 1] || "";
  const isStats = parts.includes("stats");
  const action = isStats ? parts[parts.length - 1] : "";
  const statsEventId = isStats ? parts[parts.length - 2] : "";
  const db = env.TOOLS_DB;
  if (!db) return json({ error:"Tools database is unavailable." }, 500);

  if (isStats && action === "view" && req.method === "POST") {
    const event = await db.prepare("SELECT id FROM tool_events WHERE id=? AND status='active' LIMIT 1").bind(statsEventId).first();
    if (!event) return json({ error:"Event not found." }, 404);
    try { await trackEvent(env, event.id, "views"); } catch (_) {}
    return json({ ok:true });
  }

  if (isStats && action === "click" && req.method === "POST") {
    const event = await db.prepare("SELECT id FROM tool_events WHERE id=? AND status='active' LIMIT 1").bind(statsEventId).first();
    if (!event) return json({ error:"Event not found." }, 404);
    try { await trackEvent(env, event.id, "link_clicks"); } catch (_) {}
    return json({ ok:true });
  }

  if (isStats && action === "stats" && req.method === "GET") {
    return eventStats(req, env, statsEventId);
  }

  if (req.method === "GET" && idOrSlug) {
    const event = await db.prepare(
      "SELECT id,name,description,event_date,timezone,image_url,theme,status,event_slug,link_url,created_at,updated_at " +
      "FROM tool_events WHERE event_slug=? AND status='active' LIMIT 1"
    ).bind(decodeURIComponent(idOrSlug)).first();
    return event ? json({ event }) : json({ error: "Event not found." }, 404);
  }

  const currentUser = await user(req, env);
  if (!currentUser) return json({ error: "Please sign in to manage events." }, 401);

  if (req.method === "GET") {
    const rows = await db.prepare(
      "SELECT id,name,description,event_date,timezone,image_url,theme,status,event_slug,link_url,created_at,updated_at " +
      "FROM tool_events WHERE user_id=? AND tool_slug='event-countdown' ORDER BY created_at DESC"
    ).bind(currentUser.id).all();
    return json({ events: rows.results || [] });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch (_) { return json({ error: "Invalid request data." }, 400); }

    const name = String(body?.name || "").trim();
    const description = String(body?.description || "").trim();
    const eventDate = String(body?.event_date || "").trim();
    const timezone = String(body?.timezone || "UTC").trim();
    const imageUrl = String(body?.image_url || "").trim();
    const linkUrl = safeUrl(body?.link_url);
    const themes = ["default","conference","wedding","birthday","sale","launch","webinar","survey","ocean","sunset","mint"];
    const theme = themes.includes(body?.theme) ? body.theme : "default";

    if (!name || name.length > 100) return json({ error: "Event name is required and must be 100 characters or fewer." }, 400);
    if (!eventDate || eventDate.length > 80) return json({ error: "A valid event date is required." }, 400);
    if (description.length > 500) return json({ error: "Description must be 500 characters or fewer." }, 400);
    if (imageUrl.length > 1000) return json({ error: "Image URL is too long." }, 400);
    if (String(body?.link_url || "").trim() && !linkUrl) return json({ error: "Please enter a valid http or https link." }, 400);

    for (let attempt = 0; attempt < 5; attempt++) {
      const id = token();
      const slug = eventSlug();
      const now = Date.now();
      try {
        await db.prepare(
          "INSERT INTO tool_events(id,user_id,tool_slug,event_slug,name,description,event_date,timezone,image_url,theme,status,link_url,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
        ).bind(id,currentUser.id,"event-countdown",slug,name,description,eventDate,timezone,imageUrl,theme,"active",linkUrl,now,now).run();
        return json({ ok:true, event_slug:slug, url:`${url.origin}/event/${slug}` }, 201);
      } catch (error) {
        if (attempt === 4) {
          console.error("Event creation failed:", error);
          return json({ error:"Unable to create the event. Please try again." }, 500);
        }
      }
    }
  }

  if ((req.method === "PUT" || req.method === "DELETE") && idOrSlug) {
    const eventId = decodeURIComponent(idOrSlug);
    const owned = await db.prepare("SELECT id FROM tool_events WHERE id=? AND user_id=? LIMIT 1").bind(eventId,currentUser.id).first();
    if (!owned) return json({ error:"Event not found." }, 404);

    if (req.method === "DELETE") {
      await db.prepare("DELETE FROM tool_events WHERE id=? AND user_id=?").bind(eventId,currentUser.id).run();
      return json({ ok:true });
    }

    let body;
    try { body = await req.json(); } catch (_) { return json({ error:"Invalid request data." }, 400); }
    const name = String(body?.name || "").trim();
    const description = String(body?.description || "").trim();
    const eventDate = String(body?.event_date || "").trim();
    const timezone = String(body?.timezone || "UTC").trim();
    const imageUrl = String(body?.image_url || "").trim();
    const linkUrl = safeUrl(body?.link_url);
    const themes = ["default","conference","wedding","birthday","sale","launch","webinar","survey","ocean","sunset","mint"];
    const theme = themes.includes(body?.theme) ? body.theme : "default";
    const status = body?.status === "paused" ? "paused" : "active";

    if (!name || name.length > 100 || !eventDate) return json({ error:"Event name and date are required." }, 400);
    if (description.length > 500) return json({ error:"Description must be 500 characters or fewer." }, 400);
    if (imageUrl.length > 1000) return json({ error:"Image URL is too long." }, 400);
    if (String(body?.link_url || "").trim() && !linkUrl) return json({ error:"Please enter a valid http or https link." }, 400);

    await db.prepare(
      "UPDATE tool_events SET name=?,description=?,event_date=?,timezone=?,image_url=?,theme=?,status=?,link_url=?,updated_at=? WHERE id=? AND user_id=?"
    ).bind(name,description,eventDate,timezone,imageUrl,theme,status,linkUrl,Date.now(),eventId,currentUser.id).run();
    return json({ ok:true, status });
  }

  return json({ error:"Method not allowed." }, 405);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/tools/event-countdown/events")) return eventsApi(req, env, url);
    if (url.pathname.startsWith("/event/")) {
      const slug = decodeURIComponent(url.pathname.slice("/event/".length));
      const db = env.TOOLS_DB;
      if (!db || !slug) return new Response("Event not found", { status:404 });
      const event = await db.prepare(
        "SELECT id,name,description,event_date,timezone,image_url,theme,status,event_slug,link_url FROM tool_events WHERE event_slug=? AND status='active' LIMIT 1"
      ).bind(slug).first();
      return event ? eventHtml(event) : new Response("Event not found", { status:404, headers:{ "Content-Type":"text/plain; charset=UTF-8" } });
    }
    return app.fetch(req, env, ctx);
  }
};