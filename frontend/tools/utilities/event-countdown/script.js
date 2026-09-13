const $=s=>document.querySelector(s);
const form=$("#eventForm");
const nameEl=$("#name"),descEl=$("#description"),dateEl=$("#eventDate");
const tzEl=$("#timezone"),themeEl=$("#theme"),imageEl=$("#imageUrl");
const linkEl=$("#linkUrl"),msg=$("#formMessage");
const pad=n=>String(n).padStart(2,"0");
const themes={
  default:{accent:"#8db4ff",card:"#151923",border:"#30384a"},
  ocean:{accent:"#67e8f9",card:"#07334b",border:"#155e75"},
  sunset:{accent:"#fdba74",card:"#401a20",border:"#7c2d12"},
  mint:{accent:"#86efac",card:"#103b2d",border:"#166534"}
};
function zones(){
  const list=["UTC",Intl.DateTimeFormat().resolvedOptions().timeZone,
    "Europe/Lisbon","Africa/Maputo","Europe/Paris",
    "America/New_York","America/Los_Angeles","Asia/Dubai","Asia/Tokyo"];
  return [...new Set(list.filter(Boolean))]
}
zones().forEach(z=>{
  const o=document.createElement("option");o.value=z;o.textContent=z;tzEl.appendChild(o)
});
tzEl.value=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";
function updateTheme(){
  const key=themeEl.value in themes?themeEl.value:"default",t=themes[key];
  const preview=$("#preview");
  preview.className=`preview theme-${key}`;
  document.documentElement.style.setProperty("--theme-accent",t.accent);
  const badge=$(".preview-badge");
  if(badge)badge.style.color=t.accent;
  document.querySelectorAll(".countdown div").forEach(x=>{
    x.style.borderColor=t.border;x.style.background=t.card
  });
  document.querySelectorAll(".countdown i").forEach(x=>x.style.color=t.accent)
}
function update(){
  const name=nameEl.value.trim()||"Your event";
  const desc=descEl.value.trim()||"Your event description will appear here.";
  $("#previewName").textContent=name;
  $("#previewDescription").textContent=desc;
  $("#preview").className=`preview theme-${themeEl.value}`;
  const img=imageEl.value.trim();
  $("#previewImage").style.backgroundImage=img?`url("${img.replace(/"/g,"%22")}")`:"none";
  $("#previewImage").classList.toggle("show",!!img);
  if(dateEl.value){
    const sec=Math.max(0,Math.floor((new Date(dateEl.value).getTime()-Date.now())/1000));
    $("#d").textContent=pad(Math.floor(sec/86400));
    $("#h").textContent=pad(Math.floor(sec%86400/3600));
    $("#m").textContent=pad(Math.floor(sec%3600/60));
    $("#s").textContent=pad(sec%60)
  }else $("#d").textContent=$("#h").textContent=$("#m").textContent=$("#s").textContent="00";
  updateTheme()
}
[nameEl,descEl,dateEl,tzEl,themeEl,imageEl,linkEl].forEach(e=>e.addEventListener("input",update));
[tzEl,themeEl].forEach(e=>e.addEventListener("change",update));
setInterval(update,1000);update();
form.addEventListener("submit",async e=>{
  e.preventDefault();msg.textContent="";
  const button=form.querySelector("button[type=submit]");
  button.disabled=true;button.innerHTML="Creating…";
  try{
    const r=await fetch("/api/tools/event-countdown/events",{
      method:"POST",credentials:"same-origin",
      headers:{"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify({
        name:nameEl.value.trim(),description:descEl.value.trim(),
        event_date:dateEl.value,timezone:tzEl.value,
        image_url:imageEl.value.trim(),theme:themeEl.value,
        link_url:linkEl.value.trim()
      })
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||"Unable to create the event.");
    const slug=data.event_slug||data.slug,url=data.url||`${location.origin}/event/${slug}`;
    $("#shareLink").value=url;
    $("#embedCode").value=`<iframe src="${url}" width="100%" height="300" frameborder="0" loading="lazy" title="${nameEl.value.trim().replace(/"/g,"&quot;")}"></iframe>`;
    $("#openEvent").href=url;
    $("#result").hidden=false;
    $("#result").scrollIntoView({behavior:"smooth",block:"center"})
  }catch(err){
    msg.textContent=err.message||"Unable to create the event."
  }finally{
    button.disabled=false;button.innerHTML="Create Countdown <b>→</b>"
  }
});
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-copy]");if(!b)return;
  const input=$("#"+b.dataset.copy);
  try{await navigator.clipboard.writeText(input.value);const old=b.textContent;b.textContent="Copied";setTimeout(()=>b.textContent=old,1400)}
  catch(_){input.select();document.execCommand("copy")}
});
