(()=>{
  const match=location.pathname.match(/^\/blog\/([^/]+)\/?$/);
  if(!match||match[1]==="article")return;

  const slug=decodeURIComponent(match[1]);
  const started=Date.now();
  const key="nexauren_blog_session";
  let session="";
  let sentEngagement=false;

  try{
    session=sessionStorage.getItem(key)||crypto.randomUUID();
    sessionStorage.setItem(key,session);
  }catch(_){
    session=`s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  async function send(event,duration_ms=0){
    const body=JSON.stringify({
      slug,
      event,
      duration_ms,
      session_id:session
    });

    try{
      const response=await fetch("/api/blog/analytics",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body,
        keepalive:true,
        credentials:"same-origin"
      });
      if(response.ok)return true;
    }catch(_){ }

    try{
      if(navigator.sendBeacon){
        return navigator.sendBeacon(
          "/api/blog/analytics",
          new Blob([body],{type:"application/json"})
        );
      }
    }catch(_){ }

    return false;
  }

  send("view");

  function engagement(){
    if(sentEngagement)return;
    const elapsed=Date.now()-started;
    if(elapsed<3000)return;
    sentEngagement=true;
    send("engagement",Math.min(elapsed,3600000));
  }

  document.addEventListener(
    "visibilitychange",
    ()=>{
      if(document.visibilityState==="hidden")engagement();
    }
  );

  window.addEventListener("pagehide",engagement);

  document.addEventListener(
    "click",
    event=>{
      const link=event.target.closest("a,button");
      if(!link)return;

      if(
        link.closest(".share")||
        link.matches('a[target="_blank"],a[href^="http"]')
      ){
        send("click");
      }
    },
    {passive:true}
  );
})();
