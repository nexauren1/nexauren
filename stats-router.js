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
  return env.ASSETS.fetch(new Request(target.toString(),{
    method:"GET",
    headers:req.headers
  }));
}

export default {
  async fetch(req,env,ctx){
    const url=new URL(req.url);

    if(url.pathname==="/admin"||url.pathname==="/admin/"){
      return adminHome(req,env);
    }

    if(url.pathname.startsWith("/admin/products")||url.pathname.startsWith("/admin/plans")){
      return adminRouter(req,env);
    }

    if(url.pathname.startsWith("/api/blog/")){
      const blogResponse=await blogRouter.fetch(req,env,ctx);
      if(blogResponse)return blogResponse;
    }

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
