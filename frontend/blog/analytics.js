(()=>{
  const match=location.pathname.match(/^\/blog\/([^/]+)\/?$/);
  if(!match||match[1]==="article")return;

  const slug=decodeURIComponent(match[1]);
  const started=Date.now();
  const sessionKey="nexauren_blog_session";
  const visitorKey="nexauren_blog_visitor";
  let session="";
  let visitor="";
  let sentEngagement=false;
  let sentExit=false;
  let maxScroll=0;

  function makeId(prefix){
    try{
      if(crypto.randomUUID)return crypto.randomUUID();
    }catch(_){ }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  try{
    session=sessionStorage.getItem(sessionKey)||makeId("s");
    sessionStorage.setItem(sessionKey,session);
  }catch(_){
    session=makeId("s");
  }

  try{
    visitor=localStorage.getItem(visitorKey)||makeId("v");
    localStorage.setItem(visitorKey,visitor);
  }catch(_){
    visitor=makeId("v");
  }

  function queryParams(){
    const p=new URLSearchParams(location.search);
    return{
      utm_source:p.get("utm_source")||null,
      utm_medium:p.get("utm_medium")||null,
      utm_campaign:p.get("utm_campaign")||null
    };
  }

  const utm=queryParams();
  const pagePath=location.pathname;

  function payload(event,duration_ms=0,extra={}){
    return JSON.stringify({
      slug,
      event,
      duration_ms,
      session_id:session,
      visitor_id:visitor,
      page_path:pagePath,
      ...utm,
      ...extra
    });
  }

  async function send(event,duration_ms=0,extra={}){
    const body=payload(event,duration_ms,extra);
    const endpoint=new URL(
      "/api/blog/analytics",
      location.origin
    ).toString();

    try{
      const response=await fetch(endpoint,{
        method:"POST",
        headers:{"Content-Type":"text/plain;charset=UTF-8"},
        body,
        credentials:"same-origin",
        mode:"same-origin",
        cache:"no-store",
        keepalive:true,
        redirect:"follow"
      });
      if(response.ok)return true;
    }catch(_){ }

    try{
      if(navigator.sendBeacon){
        return navigator.sendBeacon(
          endpoint,
          new Blob([body],{
            type:"text/plain;charset=UTF-8"
          })
        );
      }
    }catch(_){ }
    return false;
  }

  send("view");
  send("page_enter",0,{entry_path:pagePath});

  function engagement(){
    if(sentEngagement)return;
    const elapsed=Date.now()-started;
    if(elapsed<3000)return;
    sentEngagement=true;
    send(
      "engagement",
      Math.min(elapsed,3600000),
      {scroll_percent:maxScroll}
    );
  }

  function exitPage(){
    if(sentExit)return;
    sentExit=true;
    const elapsed=Math.min(
      Date.now()-started,
      3600000
    );
    send(
      "page_exit",
      elapsed,
      {
        exit_path:pagePath,
        scroll_percent:maxScroll
      }
    );
    engagement();
  }

  let lastHeartbeat=Date.now();
  function heartbeat(){
    const now=Date.now();
    if(now-lastHeartbeat<15000)return;
    lastHeartbeat=now;
    send(
      "heartbeat",
      Math.min(now-started,3600000),
      {scroll_percent:maxScroll}
    );
  }

  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="hidden"){
      exitPage();
    }else{
      lastHeartbeat=Date.now();
    }
  });

  window.addEventListener("pagehide",exitPage);

  setInterval(()=>{
    if(document.visibilityState==="visible"){
      heartbeat();
    }
  },15000);

  function reportScroll(){
    const max=document.documentElement.scrollHeight-
      window.innerHeight;
    if(max<=0)return;

    const percent=Math.min(
      100,
      Math.round((window.scrollY/max)*100)
    );

    if(percent>maxScroll)maxScroll=percent;

    [25,50,75,90,100].forEach(mark=>{
      const key=`nexauren_scroll_${mark}_${slug}`;
      if(percent>=mark&&!sessionStorage.getItem(key)){
        try{
          sessionStorage.setItem(key,"1");
        }catch(_){ }
        send(
          "scroll",
          0,
          {scroll_percent:mark}
        );
      }
    });
  }

  window.addEventListener(
    "scroll",
    reportScroll,
    {passive:true}
  );

  document.addEventListener("click",event=>{
    const target=event.target;
    const link=target?.closest?.("a,button");
    if(!link)return;

    const href=link.href||"";
    let external=false;

    try{
      external=new URL(
        href,
        location.href
      ).origin!==location.origin;
    }catch(_){ }

    if(link.closest(".share")){
      send("click",0,{target_url:href});
    }

    if(external){
      send("outbound_click",0,{target_url:href});
    }

    if(
      href&&
      href.startsWith(location.origin+"/blog/")
    ){
      send("internal_click",0,{target_url:href});
    }
  },{passive:true});
})();