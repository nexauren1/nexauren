function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "Content-Type":"application/json; charset=UTF-8",
      "Cache-Control":"no-store"
    }
  });
}

function slugify(value){
  return String(value||"")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"")
    .slice(0,180);
}

function uaInfo(value){
  const ua=String(value||"").toLowerCase();
  const device=/tablet|ipad/.test(ua)
    ? "tablet"
    : /mobile|android|iphone|ipod/.test(ua)
      ? "mobile"
      : "desktop";
  const browser=/edg\//.test(ua)
    ? "Edge"
    : /chrome\//.test(ua)
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
  return {device,browser,os};
}

function referrerHost(value){
  try{
    return new URL(value).hostname
      .replace(/^www\./,"")
      .slice(0,180)||"Direct";
  }catch(_){
    return value?"Other":"Direct";
  }
}

function dateOnly(value){
  return /^\d{4}-\d{2}-\d{2}$/.test(value||"")
    ? value
    : null;
}

function previousRange(from,to){
  const a=new Date(`${from}T00:00:00Z`);
  const b=new Date(`${to}T00:00:00Z`);
  const days=Math.round((b-a)/86400000)+1;
  const previousTo=new Date(a.getTime()-86400000);
  const previousFrom=new Date(
    previousTo.getTime()-(days-1)*86400000
  );
  return {
    from:previousFrom.toISOString().slice(0,10),
    to:previousTo.toISOString().slice(0,10)
  };
}

async function adminUser(req,env){
  const cookie=req.headers.get("Cookie")||"";
  const match=cookie.match(/nexauren_session=([^;]+)/);
  if(!match)return null;
  return env.DB.prepare(
    "SELECT u.id,u.email,u.name,u.role " +
    "FROM sessions s JOIN users u ON u.id=s.user_id " +
    "WHERE s.token=? AND s.expires_at>? LIMIT 1"
  ).bind(match[1],Date.now()).first();
}

async function requireAdmin(req,env){
  const user=await adminUser(req,env);
  if(!user)return json({error:"Please sign in."},401);
  if(String(user.role||"").toLowerCase()!=="admin"){
    return json({error:"Admin access required."},403);
  }
  return user;
}

async function record(req,env){
  if(req.method!=="POST")return null;
  if(!env.BLOG_DB){
    return json({error:"Blog database is not configured."},500);
  }
  const body=await req.json().catch(()=>null);
  if(!body)return json({error:"Invalid JSON."},400);

  const event=String(body.event||"").trim();
  const allowed=[
    "view","enter","heartbeat","engagement",
    "scroll","click","exit"
  ];
  if(!allowed.includes(event)){
    return json({error:"Invalid analytics event."},400);
  }

  const sessionId=String(body.session_id||"")
    .trim().slice(0,180);
  if(!sessionId)return json({error:"session_id is required."},400);

  const path=String(body.path||"")
    .trim().slice(0,500)||"/blog/";
  const slug=String(body.slug||"").trim()
    ? slugify(body.slug)
    : null;
  const duration=Math.min(
    3600000,
    Math.max(0,Number(body.duration_ms)||0)
  );
  const scroll=Math.min(
    100,
    Math.max(0,Number(body.scroll_percent)||0)
  );
  const linkUrl=String(body.link_url||"")
    .trim().slice(0,500)||null;
  const pageTitle=String(body.page_title||"")
    .trim().slice(0,300)||null;
  const referrer=referrerHost(
    req.headers.get("Referer")||body.referrer||""
  );
  const country=String(
    req.headers.get("CF-IPCountry")||""
  ).slice(0,8)||null;
  const ua=uaInfo(req.headers.get("User-Agent"));

  try{
    let postId=null;
    if(slug){
      const post=await env.BLOG_DB.prepare(
        "SELECT id FROM posts WHERE slug=? " +
        "AND status='published' AND " +
        "(published_at IS NULL OR datetime(" +
        "replace(replace(published_at,'T',' '),'Z',''))" +
        "<=CURRENT_TIMESTAMP) LIMIT 1"
      ).bind(slug).first();
      if(post)postId=post.id;
    }

    await env.BLOG_DB.prepare(
      "INSERT INTO blog_analytics_events_v2(" +
      "post_id,event_type,session_id,page_path,page_title," +
      "referrer_host,country,device_type,browser,os," +
      "duration_ms,scroll_percent,link_url,occurred_at) " +
      "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)"
    ).bind(
      postId,event,sessionId,path,pageTitle,
      referrer,country,ua.device,ua.browser,ua.os,
      duration,scroll,linkUrl
    ).run();

    return json({ok:true});
  }catch(error){
    console.error("Nexauren advanced blog analytics error",error);
    return json({
      error:"Analytics event could not be recorded.",
      detail:String(error?.message||error)
    },500);
  }
}

function bounds(from,to){
  return [
    `${from} 00:00:00`,
    `${to} 23:59:59`
  ];
}

async function metrics(db,from,to){
  const b=bounds(from,to);
  const where="WHERE occurred_at BETWEEN ? AND ?";
  const summary=await db.prepare(
    "SELECT " +
    "COUNT(CASE WHEN event_type='view' THEN 1 END) views," +
    "COUNT(DISTINCT CASE WHEN event_type IN " +
    "('view','enter','heartbeat','engagement','click','exit') " +
    "THEN session_id END) visitors," +
    "COUNT(DISTINCT CASE WHEN event_type='enter' " +
    "THEN session_id END) sessions," +
    "COUNT(CASE WHEN event_type='click' THEN 1 END) clicks," +
    "COUNT(CASE WHEN event_type='engagement' " +
    "AND duration_ms>=3000 THEN 1 END) engaged_reads," +
    "COALESCE(AVG(CASE WHEN event_type='engagement' " +
    "AND duration_ms>0 THEN duration_ms END),0) avg_read_ms," +
    "COALESCE(AVG(CASE WHEN event_type='heartbeat' " +
    "AND duration_ms>0 THEN duration_ms END),0) avg_session_ms," +
    "COALESCE(AVG(CASE WHEN event_type='scroll' " +
    "THEN scroll_percent END),0) avg_scroll " +
    where
  ).bind(...b).first();

  const daily=await db.prepare(
    "SELECT substr(occurred_at,1,10) day," +
    "COUNT(CASE WHEN event_type='view' THEN 1 END) views," +
    "COUNT(DISTINCT CASE WHEN event_type IN " +
    "('view','enter') THEN session_id END) visitors," +
    "COUNT(CASE WHEN event_type='click' THEN 1 END) clicks," +
    "COUNT(CASE WHEN event_type='engagement' " +
    "AND duration_ms>=3000 THEN 1 END) reads " +
    where+
    " GROUP BY day ORDER BY day"
  ).bind(...b).all();

  const posts=await db.prepare(
    "SELECT COALESCE(p.title,e.page_path,'Unknown') title," +
    "COALESCE(p.slug,e.page_path,'') slug,"+
    "COUNT(CASE WHEN e.event_type='view' THEN 1 END) views,"+
    "COUNT(DISTINCT CASE WHEN e.event_type='view' " +
    "THEN e.session_id END) visitors,"+
    "COUNT(CASE WHEN e.event_type='click' THEN 1 END) clicks,"+
    "COALESCE(AVG(CASE WHEN e.event_type='engagement' " +
    "AND e.duration_ms>0 THEN e.duration_ms END),0) avg_read_ms,"+
    "COALESCE(AVG(CASE WHEN e.event_type='scroll' " +
    "THEN e.scroll_percent END),0) avg_scroll " +
    "FROM blog_analytics_events_v2 e " +
    "LEFT JOIN posts p ON p.id=e.post_id " +
    where+
    " GROUP BY COALESCE(p.id,e.page_path) " +
    "ORDER BY views DESC LIMIT 20"
  ).bind(...b).all();

  const list=async(sql)=>{
    const r=await db.prepare(sql).bind(...b).all();
    return r.results||[];
  };

  const sources=await list(
    "SELECT COALESCE(NULLIF(referrer_host,''),'Direct') source,"+
    "COUNT(DISTINCT session_id) visitors,"+
    "COUNT(CASE WHEN event_type='view' THEN 1 END) views " +
    where+" GROUP BY source ORDER BY visitors DESC LIMIT 15"
  );
  const countries=await list(
    "SELECT COALESCE(NULLIF(country,''),'Unknown') country,"+
    "COUNT(DISTINCT session_id) visitors " +
    where+" GROUP BY country ORDER BY visitors DESC LIMIT 15"
  );
  const devices=await list(
    "SELECT COALESCE(NULLIF(device_type,''),'Unknown') device,"+
    "COUNT(DISTINCT session_id) visitors " +
    where+" GROUP BY device ORDER BY visitors DESC"
  );
  const browsers=await list(
    "SELECT COALESCE(NULLIF(browser,''),'Other') browser,"+
    "COUNT(DISTINCT session_id) visitors " +
    where+" GROUP BY browser ORDER BY visitors DESC"
  );
  const os=await list(
    "SELECT COALESCE(NULLIF(os,''),'Other') os,"+
    "COUNT(DISTINCT session_id) visitors " +
    where+" GROUP BY os ORDER BY visitors DESC"
  );
  const exits=await list(
    "SELECT page_path page,"+
    "COUNT(*) exits " +
    where+" AND event_type='exit' " +
    "GROUP BY page_path ORDER BY exits DESC LIMIT 15"
  );
  const links=await list(
    "SELECT COALESCE(NULLIF(link_url,''),'Unknown') link,"+
    "COUNT(*) clicks " +
    where+" AND event_type='click' " +
    "GROUP BY link_url ORDER BY clicks DESC LIMIT 15"
  );
  const scroll=await list(
    "SELECT page_path page,ROUND(AVG(scroll_percent),1) avg_scroll " +
    where+" AND event_type='scroll' " +
    "GROUP BY page_path ORDER BY avg_scroll DESC LIMIT 15"
  );

  return {
    summary:{
      views:Number(summary?.views||0),
      visitors:Number(summary?.visitors||0),
      sessions:Number(summary?.sessions||0),
      clicks:Number(summary?.clicks||0),
      engaged_reads:Number(summary?.engaged_reads||0),
      avg_read_ms:Number(summary?.avg_read_ms||0),
      avg_session_ms:Number(summary?.avg_session_ms||0),
      avg_scroll:Number(summary?.avg_scroll||0)
    },
    daily:daily.results||[],
    posts:posts.results||[],
    sources,
    countries,
    devices,
    browsers,
    os,
    exits,
    links,
    scroll
  };
}

async function admin(req,env){
  const user=await requireAdmin(req,env);
  if(user instanceof Response)return user;
  if(!env.BLOG_DB){
    return json({error:"Blog database is not configured."},500);
  }
  const url=new URL(req.url);
  const range=url.searchParams.get("range")||"7";
  let from=dateOnly(url.searchParams.get("from"));
  let to=dateOnly(url.searchParams.get("to"));
  const today=new Date();

  if(!from||!to){
    const days=range==="28"?28:range==="90"?90:7;
    const start=new Date(today);
    start.setUTCDate(start.getUTCDate()-(days-1));
    from=start.toISOString().slice(0,10);
    to=today.toISOString().slice(0,10);
  }

  if(from>to)return json({error:"Invalid date range."},400);

  const current=await metrics(env.BLOG_DB,from,to);
  const previous=previousRange(from,to);
  const previousData=await metrics(
    env.BLOG_DB,
    previous.from,
    previous.to
  );

  const percent=(a,b)=>{
    const x=Number(a||0),y=Number(b||0);
    if(!y)return x?100:0;
    return Number((((x-y)/y)*100).toFixed(1));
  };

  const comparison={
    from:previous.from,
    to:previous.to,
    visitors:percent(
      current.summary.visitors,
      previousData.summary.visitors
    ),
    views:percent(
      current.summary.views,
      previousData.summary.views
    ),
    sessions:percent(
      current.summary.sessions,
      previousData.summary.sessions
    ),
    engaged_reads:percent(
      current.summary.engaged_reads,
      previousData.summary.engaged_reads
    ),
    clicks:percent(
      current.summary.clicks,
      previousData.summary.clicks
    ),
    avg_read_ms:percent(
      current.summary.avg_read_ms,
      previousData.summary.avg_read_ms
    )
  };

  const realtime=await env.BLOG_DB.prepare(
    "SELECT COUNT(DISTINCT session_id) visitors " +
    "FROM blog_analytics_events_v2 " +
    "WHERE occurred_at>=datetime('now','-5 minutes')"
  ).first();

  return json({
    ok:true,
    range:{from,to},
    comparison,
    summary:current.summary,
    daily:current.daily,
    top_posts:current.posts,
    sources:current.sources,
    countries:current.countries,
    devices:current.devices,
    browsers:current.browsers,
    operating_systems:current.os,
    exit_pages:current.exits,
    top_links:current.links,
    scroll_depth:current.scroll,
    realtime:{visitors:Number(realtime?.visitors||0)}
  });
}

export async function blogAnalyticsRouter(req,env){
  const path=new URL(req.url).pathname;
  if(path==="/api/blog/analytics/v2"){
    if(req.method==="POST")return record(req,env);
    if(req.method==="GET")return admin(req,env);
  }
  return null;
}
