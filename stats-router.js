import eventRouter from "./event-router.js";
import blogRouter from "./blog-router.js";
import { adminRouter } from "./admin.js";
import { adminHome } from "./admin-home.js";
import { getEventCountdownRules } from "./frontend/tools/utilities/event-countdown/rules.js";

function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "Content-Type":"application/json; charset=UTF-8",
      "Cache-Control":"no-store"
    }
  });
}

function xmlEscape(value){
  return String(value||"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&apos;");
}

const COOKIE="nexauren_session";

async function currentUser(req,env){
  const cookie=req.headers.get("Cookie")||"";
  const match=cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
  if(!match)return null;
  return env.DB.prepare(
    "SELECT u.id,u.email,u.name,u.role FROM sessions s " +
    "JOIN users u ON u.id=s.user_id " +
    "WHERE s.token=? AND s.expires_at>? LIMIT 1"
  ).bind(match[1],Date.now()).first();
}

async function toolPlan(env,userId){
  try{
    const row=await env.DB.prepare(
      "SELECT p.slug FROM subscriptions s " +
      "JOIN plans p ON p.id=s.plan_id " +
      "WHERE s.user_id=? AND s.status='active' AND p.active=1 " +
      "ORDER BY s.created_at DESC LIMIT 1"
    ).bind(userId).first();
    const plan=String(row?.slug||"free").toLowerCase();
    if(["free","pro","premium"].includes(plan))return plan;
  }catch(_){ }
  return "free";
}

async function catalogToolCount(env){
  if(!env.ASSETS)return 0;
  try{
    const url=new URL("/data/tools.json","https://nexauren.internal");
    const response=await env.ASSETS.fetch(new Request(url.toString()));
    if(!response.ok)return 0;
    const data=await response.json();
    const tools=Array.isArray(data)?data:data?.tools;
    if(!Array.isArray(tools))return 0;
    return tools.filter(tool=>String(tool?.status||"").toLowerCase()==="published").length;
  }catch(_){
    return 0;
  }
}

async function renderAdminHome(req,env){
  const response=await adminHome(req,env);
  if(req.method!=="GET"||!response.ok)return response;

  const toolCount=await catalogToolCount(env);
  if(!toolCount)return response;

  const html=await response.text();
  const updated=html.replace(
    /(<div class="stat-label">Ferramentas publicadas<\/div>\s*<div class="stat-value">)\d+(<\/div>)/,
    `$1${toolCount}$2`
  );

  return new Response(updated,{
    status:response.status,
    headers:response.headers
  });
}

async function renderSitemap(req,env){
  if(req.method!=="GET"||!env.BLOG_DB)return null;

  const path=new URL(req.url).pathname;
  if(path!=="/sitemap.xml")return null;

  const result=await env.BLOG_DB.prepare(
    "SELECT p.slug,p.published_at,p.updated_at,p.cover_image " +
    "FROM posts p WHERE p.status='published' AND " +
    "(p.published_at IS NULL OR " +
    "datetime(replace(replace(p.published_at,'T',' '),'Z',''))<=CURRENT_TIMESTAMP) " +
    "ORDER BY COALESCE(p.published_at,p.created_at) DESC"
  ).all();

  const staticUrls=[
    "/","/about/","/blog/","/blog/business/","/blog/culture/",
    "/blog/guides/","/blog/news/","/blog/technology/","/categories/",
    "/category/","/category/ai/","/category/audio/","/category/image/",
    "/category/marketplace/","/category/pdf/","/category/text/",
    "/category/utilities/","/cookies/","/faq/","/plans/","/privacy/",
    "/terms/","/tools/"
  ];

  const lines=[
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
      'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'
  ];

  for(const pathName of staticUrls){
    lines.push(`<url><loc>https://nexaurenstory.com${pathName}</loc></url>`);
  }

  for(const post of result.results||[]){
    const loc=`https://nexaurenstory.com/blog/${encodeURIComponent(post.slug)}/`;
    const image=`https://nexaurenstory.com/api/blog/image/${encodeURIComponent(post.slug)}`;
    const lastmod=post.updated_at||post.published_at;
    lines.push("<url>");
    lines.push(`<loc>${xmlEscape(loc)}</loc>`);
    if(lastmod)lines.push(`<lastmod>${xmlEscape(lastmod)}</lastmod>`);
    if(post.cover_image){
      lines.push("<image:image>");
      lines.push(`<image:loc>${xmlEscape(image)}</image:loc>`);
      lines.push("</image:image>");
    }
    lines.push("</url>");
  }

  lines.push("</urlset>");

  return new Response(lines.join("\n"),{
    status:200,
    headers:{
      "Content-Type":"application/xml; charset=UTF-8",
      "Cache-Control":"public, max-age=300, s-maxage=300"
    }
  });
}

async function directBlogAnalytics(req,env){
  const url=new URL(req.url);
  if(url.pathname!=="/api/blog/analytics"||req.method!=="POST")return null;
  if(!env.BLOG_DB)return json({error:"Blog database is not configured."},500);

  const body=await req.json().catch(()=>null);
  if(!body)return json({error:"Invalid JSON."},400);

  const slug=String(body.slug||"")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"")
    .slice(0,180);
  const eventType=["view","engagement","click"].includes(body.event)
    ? body.event
    : null;
  if(!slug||!eventType){
    return json({error:"slug and a valid event are required."},400);
  }

  try{
    const post=await env.BLOG_DB.prepare(
      "SELECT id FROM posts WHERE slug=? AND status='published' AND " +
      "(p.published_at IS NULL OR datetime(replace(replace(p.published_at,'T',' '),'Z',''))<=CURRENT_TIMESTAMP) LIMIT 1"
    ).bind(slug).first();

    if(!post)return json({error:"Post not found."},404);

    const ua=String(req.headers.get("User-Agent")||"").toLowerCase();
    const device=/tablet|ipad/.test(ua)
      ? "tablet"
      : /mobile|android|iphone|ipod/.test(ua)
        ? "mobile"
        : "desktop";
    const browser=/edg\//.test(ua)
      ? "Edge"
      : /chrome\//.test(ua)&&!/edg\//.test(ua)
        ? "Chrome"
        : /firefox\//.test(ua)
          ? "Firefox"
          : /safari\//.test(ua)&&!/chrome\//.test(ua)
            ? "Safari"
            : /opera|opr\//.test(ua)
              ? "Opera"
              : "Other";
    const os=/windows/.test(ua)
      ? "Windows"
      : /android/.test(ua)
        ? "Android"
        : /iphone|ipad|ipod/.test(ua)
          ? "iOS"
          : /mac os|macintosh/.test(ua)
            ? "macOS"
            : /linux/.test(ua)
              ? "Linux"
              : "Other";
    const referrerValue=req.headers.get("Referer")||"";
    let referrer="Direct";
    try{
      referrer=new URL(referrerValue).hostname
        .replace(/^www\./,"")
        .slice(0,180)||"Direct";
    }catch(_){
      if(referrerValue)referrer="Other";
    }
    const country=String(
      req.headers.get("CF-IPCountry")||""
    ).slice(0,8)||null;
    const sessionId=String(body.session_id||"")
      .trim()
      .slice(0,180)||null;
    const duration=Math.min(
      3600000,
      Math.max(0,Number(body.duration_ms)||0)
    );

    await env.BLOG_DB.prepare(
      "INSERT INTO blog_analytics_events(" +
      "post_id,event_type,session_id,referrer_host,country," +
      "device_type,browser,os,duration_ms" +
      ") VALUES(?,?,?,?,?,?,?,?,?)"
    ).bind(
      post.id,
      eventType,
      sessionId,
      referrer,
      country,
      device,
      browser,
      os,
      duration
    ).run();

    return json({ok:true});
  }catch(error){
    console.error("Nexauren direct blog analytics error",error);
    return json({
      error:"Analytics event could not be recorded.",
      detail:String(error?.message||error)
    },500);
  }
}

async function rulesApi(req,env){
  if(req.method!=="GET")return null;
  const user=await currentUser(req,env);
  if(!user)return json({error:"Please sign in."},401);
  const plan=await toolPlan(env,user.id);
  const rules=getEventCountdownRules(plan);
  let total=0;
  try{
    const row=await env.TOOLS_DB.prepare(
      "SELECT COUNT(*) AS total FROM tool_events WHERE user_id=? AND tool_slug=?"
    ).bind(user.id,"event-countdown").first();
    total=Number(row?.total||0);
  }catch(_){ }
  return json({
    ok:true,
    plan,
    maxEvents:Number.isFinite(rules.maxEvents)?rules.maxEvents:null,
    eventsUsed:total,
    allowedThemes:rules.allowedThemes,
    statistics:rules.statistics
  });
}

async function enforceCreate(req,env){
  const user=await currentUser(req,env);
  if(!user)return json({error:"Please sign in to create an event."},401);
  const plan=await toolPlan(env,user.id);
  const rules=getEventCountdownRules(plan);
  const count=await env.TOOLS_DB.prepare(
    "SELECT COUNT(*) AS total FROM tool_events WHERE user_id=? AND tool_slug=?"
  ).bind(user.id,"event-countdown").first();
  if(Number(count?.total||0)>=rules.maxEvents){
    return json({error:`Your ${plan} plan allows up to ${rules.maxEvents} Event Countdown events.`,code:"EVENT_LIMIT_REACHED",plan,limit:rules.maxEvents},403);
  }
  const body=await req.clone().json().catch(()=>({}));
  const theme=String(body?.theme||"default").toLowerCase();
  if(!rules.allowedThemes.includes(theme)){
    return json({error:`The ${theme} theme is not available on your ${plan} plan.`,code:"THEME_NOT_AVAILABLE",plan,theme,allowedThemes:rules.allowedThemes},403);
  }
  return null;
}

async function enforceUpdate(req,env,eventId){
  const user=await currentUser(req,env);
  if(!user)return json({error:"Please sign in to edit this event."},401);
  const owned=await env.TOOLS_DB.prepare(
    "SELECT id FROM tool_events WHERE id=? AND user_id=? LIMIT 1"
  ).bind(eventId,user.id).first();
  if(!owned)return null;
  const body=await req.clone().json().catch(()=>({}));
  if(body?.theme===undefined)return null;
  const plan=await toolPlan(env,user.id);
  const rules=getEventCountdownRules(plan);
  const theme=String(body.theme||"default").toLowerCase();
  if(!rules.allowedThemes.includes(theme)){
    return json({error:`The ${theme} theme is not available on your ${plan} plan.`,code:"THEME_NOT_AVAILABLE",plan,theme,allowedThemes:rules.allowedThemes},403);
  }
  return null;
}

async function enforceStats(req,env,eventId){
  const user=await currentUser(req,env);
  if(!user)return json({error:"Please sign in to view statistics."},401);
  const owned=await env.TOOLS_DB.prepare(
    "SELECT id FROM tool_events WHERE id=? AND user_id=? LIMIT 1"
  ).bind(eventId,user.id).first();
  if(!owned)return null;
  const plan=await toolPlan(env,user.id);
  const rules=getEventCountdownRules(plan);
  if(!rules.statistics){
    return json({error:"Event Countdown statistics are available on Pro and Premium plans.",code:"STATISTICS_PLAN_REQUIRED",plan},403);
  }
  return null;
}

async function recordStats(req,env){
  const match=new URL(req.url).pathname.match(
    /^\/api\/tools\/event-countdown\/events\/([^/]+)\/stats\/(view|click)$/
  );
  if(!match||req.method!=="POST")return null;
  const eventId=decodeURIComponent(match[1]);
  const field=match[2]==="view"?"views":"link_clicks";
  const db=env.TOOLS_DB;
  if(!db)return json({error:"Tools database is unavailable."},500);
  const event=await db.prepare(
    "SELECT id FROM tool_events WHERE id=? AND status='active' LIMIT 1"
  ).bind(eventId).first();
  if(!event)return json({error:"Event not found."},404);
  try{
    const day=new Date().toISOString().slice(0,10);
    const views=field==="views"?1:0;
    const clicks=field==="link_clicks"?1:0;
    await db.prepare(
      "INSERT INTO event_stats(event_id,day,views,link_clicks) " +
      "VALUES(?,?,?,?) " +
      "ON CONFLICT(event_id,day) DO UPDATE SET " +
      "views=views+excluded.views, " +
      "link_clicks=link_clicks+excluded.link_clicks"
    ).bind(eventId,day,views,clicks).run();
    return json({ok:true,field,day});
  }catch(error){
    return json({error:"Could not record event statistics.",detail:String(error?.message||error)},500);
  }
}

async function blogPage(req,env){
  if(req.method!=="GET"||!env.ASSETS)return null;
  const url=new URL(req.url);
  const match=url.pathname.match(/^\/blog\/([^/]+)\/?$/);
  if(!match)return null;
  const slug=decodeURIComponent(match[1]);
  if(slug==="article")return null;

  const target=new URL("/blog/article/",req.url);
  const response=await env.ASSETS.fetch(new Request(target.toString(),{
    method:"GET",
    headers:req.headers
  }));
  if(!response.ok)return response;

  const post=await env.BLOG_DB.prepare(
    "SELECT p.title,p.excerpt,p.cover_image,p.cover_image_alt,p.seo_title," +
    "p.seo_description,p.canonical_url,c.name AS category_name " +
    "FROM posts p LEFT JOIN categories c ON c.id=p.category_id " +
    "WHERE p.slug=? AND p.status='published' AND " +
    "(p.published_at IS NULL OR " +
    "datetime(replace(replace(p.published_at,'T',' '),'Z',''))<=CURRENT_TIMESTAMP) " +
    "LIMIT 1"
  ).bind(slug).first();

  if(!post)return response;

  const html=await response.text();
  const title=String(post.seo_title||post.title||"Article — Nexauren");
  const description=String(post.seo_description||post.excerpt||"Nexauren Blog");
  const image=post.cover_image
    ? `https://nexaurenstory.com/api/blog/image/${encodeURIComponent(slug)}`
    : "https://nexaurenstory.com/favicon.png?v=2";
  const canonical=String(
    post.canonical_url||`https://nexaurenstory.com/blog/${encodeURIComponent(slug)}/`
  );

  const replaceMeta=(source,pattern,value)=>source.replace(pattern,value);
  let updated=html;
  updated=replaceMeta(
    updated,
    /<meta property="og:title" content="[^"]*">/,
    `<meta property="og:title" content="${xmlEscape(title)}">`
  );
  updated=replaceMeta(
    updated,
    /<meta property="og:description" content="[^"]*">/,
    `<meta property="og:description" content="${xmlEscape(description)}">`
  );
  updated=replaceMeta(
    updated,
    /<meta property="og:url" content="[^"]*">/,
    `<meta property="og:url" content="${xmlEscape(canonical)}">`
  );
  updated=replaceMeta(
    updated,
    /<meta property="og:image" content="[^"]*">/,
    `<meta property="og:image" content="${xmlEscape(image)}">`
  );
  updated=replaceMeta(
    updated,
    /<meta name="twitter:title" content="[^"]*">/,
    `<meta name="twitter:title" content="${xmlEscape(title)}">`
  );
  updated=replaceMeta(
    updated,
    /<meta name="twitter:description" content="[^"]*">/,
    `<meta name="twitter:description" content="${xmlEscape(description)}">`
  );
  updated=replaceMeta(
    updated,
    /<meta name="twitter:image" content="[^"]*">/,
    `<meta name="twitter:image" content="${xmlEscape(image)}">`
  );
  updated=replaceMeta(
    updated,
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${xmlEscape(description)}">`
  );
  updated=replaceMeta(
    updated,
    /<title>[^<]*<\/title>/,
    `<title>${xmlEscape(title)} — Nexauren</title>`
  );

  const headers=new Headers(response.headers);
  headers.set("Content-Type","text/html; charset=UTF-8");
  headers.set("Cache-Control","public, max-age=60, s-maxage=300");

  return new Response(updated,{status:response.status,headers});
}

export default {
  async fetch(req,env,ctx){
    const url=new URL(req.url);

    if(url.pathname==="/admin"||url.pathname==="/admin/"){
      return renderAdminHome(req,env);
    }

    if(url.pathname.startsWith("/admin/products")||url.pathname.startsWith("/admin/plans")){
      return adminRouter(req,env);
    }

    const directAnalytics=await directBlogAnalytics(req,env);
    if(directAnalytics)return directAnalytics;

    if(url.pathname.startsWith("/api/blog/")){
      const blogResponse=await blogRouter.fetch(req,env,ctx);
      if(blogResponse)return blogResponse;
    }

    const sitemapResponse=await renderSitemap(req,env);
    if(sitemapResponse)return sitemapResponse;

    const blogResponse=await blogPage(req,env);
    if(blogResponse)return blogResponse;

    if(url.pathname==="/api/tools/event-countdown/rules")return rulesApi(req,env);

    const createPath=url.pathname==="/api/tools/event-countdown/events";
    if(createPath&&req.method==="POST"){
      const blocked=await enforceCreate(req,env);
      if(blocked)return blocked;
    }

    const eventMatch=url.pathname.match(/^\/api\/tools\/event-countdown\/events\/([^/]+)$/);
    if(eventMatch&&req.method==="PUT"){
      const blocked=await enforceUpdate(req,env,decodeURIComponent(eventMatch[1]));
      if(blocked)return blocked;
    }

    const statsPage=url.pathname.match(/^\/api\/tools\/event-countdown\/events\/([^/]+)\/stats$/);
    if(statsPage&&req.method==="GET"){
      const blocked=await enforceStats(req,env,decodeURIComponent(statsPage[1]));
      if(blocked)return blocked;
    }

    const statsResponse=await recordStats(req,env);
    if(statsResponse)return statsResponse;

    return eventRouter.fetch(req,env,ctx);
  }
};
