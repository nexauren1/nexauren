(()=>{
  const path=location.pathname.match(/^\/blog\/([^/]+)\/?$/);
  if(!path||path[1]==="article")return;
  const slug=decodeURIComponent(path[1]);
  const started=Date.now();
  let sentEngagement=false;
  const send=(event,duration_ms=0)=>{
    const body=JSON.stringify({slug,event,duration_ms});
    try{if(navigator.sendBeacon){navigator.sendBeacon("/api/blog/analytics",new Blob([body],{type:"application/json"}));return;}}catch(_){ }
    fetch("/api/blog/analytics",{method:"POST",headers:{"Content-Type":"application/json"},body,keepalive:true}).catch(()=>{});
  };
  send("view");
  const engagement=()=>{if(sentEngagement)return;const elapsed=Date.now()-started;if(elapsed<3000)return;sentEngagement=true;send("engagement",Math.min(elapsed,3600000));};
  const visibility=()=>{if(document.visibilityState==="hidden")engagement();};
  document.addEventListener("visibilitychange",visibility);
  window.addEventListener("pagehide",engagement);
  document.addEventListener("click",event=>{
    const link=event.target.closest("a,button");
    if(!link)return;
    if(link.closest(".share")||link.matches("a[target=\"_blank\"],a[href^=\"http\"]"))send("click");
  },{passive:true});
})();
