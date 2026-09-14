const $=s=>document.querySelector(s);
const form=$("#eventForm");
const nameEl=$("#name"),descEl=$("#description"),dateEl=$("#eventDate"),tzEl=$("#timezone"),imageEl=$("#imageUrl"),linkEl=$("#linkUrl"),msg=$("#formMessage");
const pad=n=>String(n).padStart(2,"0");
const themes={
 default:{accent:"#8db4ff",card:"#151923",border:"#30384a"},conference:{accent:"#a78bfa",card:"#17112b",border:"#5b21b6"},wedding:{accent:"#f9a8d4",card:"#2b1724",border:"#9d174d"},birthday:{accent:"#facc15",card:"#29200b",border:"#a16207"},sale:{accent:"#fb7185",card:"#2b0b12",border:"#be123c"},launch:{accent:"#38bdf8",card:"#071b2d",border:"#0369a1"},webinar:{accent:"#c4b5fd",card:"#19152e",border:"#6d28d9"},survey:{accent:"#5eead4",card:"#092522",border:"#0f766e"},ocean:{accent:"#67e8f9",card:"#07334b",border:"#155e75"},sunset:{accent:"#fdba74",card:"#401a20",border:"#7c2d12"},mint:{accent:"#86efac",card:"#103b2d",border:"#166534"}
};
function zones(){return [...new Set(["UTC",Intl.DateTimeFormat().resolvedOptions().timeZone,"Europe/Lisbon","Africa/Maputo","Europe/Paris","America/New_York","America/Los_Angeles","Asia/Dubai","Asia/Tokyo"].filter(Boolean))]}
zones().forEach(z=>{const o=document.createElement("option");o.value=z;o.textContent=z;tzEl.appendChild(o)});tzEl.value=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";
let currentTheme="default",rules=null;
function updateTheme(){
 const t=themes[currentTheme]||themes.default,p=$("#preview");p.className=`preview theme-${currentTheme}`;document.documentElement.style.setProperty("--accent",t.accent);document.documentElement.style.setProperty("--theme-accent",t.accent);
 document.querySelectorAll(".countdown div").forEach(x=>{x.style.borderColor=t.border;x.style.background=t.card});document.querySelectorAll(".countdown i").forEach(x=>x.style.color=t.accent);
 document.querySelectorAll(".theme-choice").forEach(b=>b.classList.toggle("active",b.dataset.theme===currentTheme));
}
function update(){
 $("#previewName").textContent=nameEl.value.trim()||"Your event";$("#previewDescription").textContent=descEl.value.trim()||"Your event description will appear here.";
 const img=imageEl.value.trim();$("#previewImage").style.backgroundImage=img?`url("${img.replace(/"/g,"%22")}")`:"none";$("#previewImage").classList.toggle("show",!!img);
 const link=linkEl.value.trim();$("#previewLink").hidden=!link;
 if(dateEl.value){const sec=Math.max(0,Math.floor((new Date(dateEl.value).getTime()-Date.now())/1000));$("#d").textContent=pad(Math.floor(sec/86400));$("#h").textContent=pad(Math.floor(sec%86400/3600));$("#m").textContent=pad(Math.floor(sec%3600/60));$("#s").textContent=pad(sec%60)}else ["#d","#h","#m","#s"].forEach(x=>$(x).textContent="00");
 updateTheme();
}
async function loadRules(){
 try{const r=await fetch("/api/tools/event-countdown/rules",{credentials:"same-origin"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Sign in to see your plan.");rules=d;const max=d.maxEvents==null?"Unlimited":d.maxEvents;$("#planHint").textContent=`${String(d.plan).toUpperCase()} · ${d.eventsUsed}/${max} events`;
 document.querySelectorAll(".theme-choice").forEach(b=>{const allowed=d.allowedThemes?.includes(b.dataset.theme);b.classList.toggle("locked",!allowed);b.title=allowed?"Available":"Upgrade your plan to unlock this theme";b.setAttribute("aria-disabled",String(!allowed));});
 }catch(e){$("#planHint").textContent="Sign in to publish · plan limits apply"}
}
document.querySelectorAll(".theme-choice").forEach(b=>b.addEventListener("click",()=>{if(b.classList.contains("locked")){msg.textContent="This theme is locked on your current plan. Upgrade to unlock it.";return}currentTheme=b.dataset.theme;msg.textContent="";update()}));
[nameEl,descEl,dateEl,tzEl,imageEl,linkEl].forEach(e=>e.addEventListener("input",update));[tzEl].forEach(e=>e.addEventListener("change",update));
setInterval(update,1000);update();loadRules();
form.addEventListener("submit",async e=>{
 e.preventDefault();msg.textContent="";
 if(rules&&rules.maxEvents!=null&&Number(rules.eventsUsed)>=Number(rules.maxEvents)){msg.textContent=`You reached your ${String(rules.plan).toUpperCase()} limit of ${rules.maxEvents} events. Upgrade your plan to create more.`;return}
 if(rules&&!rules.allowedThemes?.includes(currentTheme)){msg.textContent="This theme is locked on your current plan. Upgrade to unlock it.";return}
 const button=form.querySelector("button[type=submit]");button.disabled=true;button.innerHTML="Publishing…";
 try{const r=await fetch("/api/tools/event-countdown/events",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({name:nameEl.value.trim(),description:descEl.value.trim(),event_date:dateEl.value,timezone:tzEl.value,image_url:imageEl.value.trim(),theme:currentTheme,link_url:linkEl.value.trim()})});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||"Unable to create the event.");const slug=data.event_slug||data.slug,url=data.url||`${location.origin}/event/${slug}`;$("#shareLink").value=url;$("#embedCode").value=`<iframe src="${url}" width="100%" height="300" frameborder="0" loading="lazy" title="${nameEl.value.trim().replace(/"/g,"&quot;")}"></iframe>`;$("#openEvent").href=url;$("#result").hidden=false;$("#result").scrollIntoView({behavior:"smooth",block:"center"});loadRules()}catch(err){msg.textContent=err.message||"Unable to create the event."}finally{button.disabled=false;button.innerHTML="Publish countdown <b>→</b>"}
});
document.addEventListener("click",async e=>{const b=e.target.closest("[data-copy]");if(!b)return;const input=$("#"+b.dataset.copy);try{await navigator.clipboard.writeText(input.value);const old=b.textContent;b.textContent="Copied";setTimeout(()=>b.textContent=old,1400)}catch(_){input.select();document.execCommand("copy")}});
