import eventRouter from "./event-router.js";

function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "Content-Type":"application/json; charset=UTF-8",
      "Cache-Control":"no-store"
    }
  });
}

export default {
  async fetch(req,env,ctx){
    const url=new URL(req.url);
    const match=url.pathname.match(
      /^\/api\/tools\/event-countdown\/events\/([^/]+)\/stats\/(view|click)$/
    );

    if(match && req.method==="POST"){
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
        return json({
          error:"Could not record event statistics.",
          detail:String(error?.message||error)
        },500);
      }
    }

    return eventRouter.fetch(req,env,ctx);
  }
};
