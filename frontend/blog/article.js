const root=document.querySelector("#article");
const progress=document.querySelector("#progress");
const topButton=document.querySelector("#top");
const slug=decodeURIComponent(location.pathname.replace(/^\/blog\//,"").replace(/\/$/,""));

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
function attr(v){return esc(v).replace(/javascript\s*:/gi,"");}
function formatDate(v){
  if(!v)return "";
  const d=new Date(v.replace(" ","T")+(v.includes("Z")||v.includes("+")?"":"Z"));
  if(Number.isNaN(d.getTime()))return "";
  return new Intl.DateTimeFormat("en",{year:"numeric",month:"long",day:"numeric"}).format(d);
}

function normalizeContent(value){
  let html=String(value??"").trim();
  if(!html)return "";

  const looksHtml=/<(p|h2|h3|ul|ol|li|blockquote|img|a|strong|em|br)\b/i.test(html);
  if(!looksHtml){
    const lines=html.split(/\r?\n+/).map(x=>x.trim()).filter(Boolean);
    html=lines.map(line=>{
      const m=line.match(/^(\d+)[.)]\s+(.+)$/);
      if(m)return `<h2>${esc(m[1]+". "+m[2])}</h2>`;
      if(/^conclus[aã]o\s*$/i.test(line))return `<h2>${esc(line)}</h2>`;
      return `<p>${esc(line)}</p>`;
    }).join("");
  }
  return html;
}

function sanitizeContent(html){
  const box=document.createElement("div");
  box.innerHTML=html;
  box.querySelectorAll("script,iframe,object,embed,style,form,base").forEach(el=>el.remove());
  box.querySelectorAll("*").forEach(el=>{
    [...el.attributes].forEach(a=>{
      const name=a.name.toLowerCase();
      const value=a.value;
      if(name.startsWith("on")||name==="srcdoc")el.removeAttribute(a.name);
      if((name==="href"||name==="src")&&/^\s*javascript:/i.test(value))el.removeAttribute(a.name);
    });
    if(el.tagName==="A")el.setAttribute("rel","noopener noreferrer");
  });
  return box.innerHTML;
}

function makeToc(){
  const content=document.querySelector(".content");
  const toc=document.querySelector(".toc");
  if(!content||!toc)return;
  const headings=[...content.querySelectorAll("h2,h3")];
  if(headings.length<2){toc.remove();return;}
  toc.innerHTML=`<div class="toc-title">On this page</div>`+headings.map((h,i)=>{
    const id=`section-${i+1}`;
    h.id=id;
    return `<a class="${h.tagName==="H3"?"sub":""}" href="#${id}">${esc(h.textContent)}</a>`;
  }).join("");
}

function addSchema(p,canonical){
  const type=String(p.type||"article").toLowerCase()==="news"||String(p.type||"").toLowerCase()==="breaking_news"?"NewsArticle":"BlogPosting";
  const data={
    "@context":"https://schema.org",
    "@type":type,
    "headline":p.title,
    "description":p.seo_description||p.excerpt||undefined,
    "datePublished":p.published_at||undefined,
    "dateModified":p.updated_at||p.published_at||undefined,
    "mainEntityOfPage":{"@type":"WebPage","@id":canonical},
    "url":canonical,
    "author":{"@type":"Person","name":p.author_name||"Nexauren"},
    "publisher":{"@type":"Organization","name":"Nexauren","url":"https://nexaurenstory.com/"}
  };
  if(p.cover_image)data.image=[p.cover_image];
  const script=document.createElement("script");
  script.type="application/ld+json";
  script.textContent=JSON.stringify(data);
  document.head.appendChild(script);

  const crumb={"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
    {"@type":"ListItem","position":1,"name":"Nexauren","item":"https://nexaurenstory.com/"},
    {"@type":"ListItem","position":2,"name":"Blog","item":"https://nexaurenstory.com/blog/"},
    {"@type":"ListItem","position":3,"name":p.title,"item":canonical}
  ]};
  const crumbScript=document.createElement("script");
  crumbScript.type="application/ld+json";
  crumbScript.textContent=JSON.stringify(crumb);
  document.head.appendChild(crumbScript);
}

function setupShare(p){
  const url=location.href;
  const title=p.title||document.title;
  const share=document.querySelector("#share");
  if(!share)return;
  share.innerHTML=`<span style="width:100%;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#6b7280">Share</span>
    <button data-share="copy">Copy link</button>
    <button data-share="native">Share</button>
    <button data-share="whatsapp">WhatsApp</button>`;
  share.addEventListener("click",async e=>{
    const btn=e.target.closest("button");
    if(!btn)return;
    const action=btn.dataset.share;
    if(action==="copy"){
      try{await navigator.clipboard.writeText(url);btn.textContent="Copied";setTimeout(()=>btn.textContent="Copy link",1500);}catch(_){window.prompt("Copy this link:",url);}
    }
    if(action==="native"&&navigator.share){await navigator.share({title,url}).catch(()=>{});}
    if(action==="whatsapp"){window.open(`https://wa.me/?text=${encodeURIComponent(title+" "+url)}`,"_blank","noopener,noreferrer");}
  });
}

async function relatedPosts(current){
  try{
    const res=await fetch("/api/blog/posts?limit=6");
    if(!res.ok)return;
    const data=await res.json();
    const list=(data.posts||[]).filter(p=>p.slug!==current.slug).slice(0,3);
    const box=document.querySelector("#related");
    if(!box||!list.length)return;
    box.innerHTML=`<h2>Continue reading</h2><div class="related-grid">${list.map(p=>`<a class="related-card" href="/blog/${encodeURIComponent(p.slug)}/">${p.cover_image?`<img src="${attr(p.cover_image)}" alt="${attr(p.cover_image_alt||p.title)}" loading="lazy">`:""}<div class="related-body"><div class="related-meta">${esc(p.category_name||"Nexauren")}</div><div class="related-title">${esc(p.title)}</div></div></a>`).join("")}</div>`;
  }catch(_){ }
}

function updateProgress(){
  const doc=document.documentElement;
  const max=doc.scrollHeight-window.innerHeight;
  progress.style.width=`${max>0?Math.min(100,(window.scrollY/max)*100):0}%`;
  if(window.scrollY>500)topButton.classList.add("show");else topButton.classList.remove("show");
}

async function load(){
  if(!slug){root.innerHTML='<div class="error"><h1>Article not found</h1><p class="excerpt">This article could not be found.</p><a class="back" href="/blog/">← Back to Blog</a></div>';return;}
  try{
    const res=await fetch(`/api/blog/posts?slug=${encodeURIComponent(slug)}`);
    if(!res.ok)throw new Error("not found");
    const data=await res.json();
    const p=data.post;
    if(!p?.title)throw new Error("not found");

    const canonical=p.canonical_url||`https://nexaurenstory.com/blog/${encodeURIComponent(p.slug)}/`;
    const desc=p.seo_description||p.excerpt||"Nexauren Blog article";
    document.documentElement.lang="en";
    document.title=`${p.seo_title||p.title} — Nexauren`;
    document.querySelector('meta[name="description"]').setAttribute("content",desc);
    document.querySelector('meta[property="og:title"]').setAttribute("content",p.title);
    document.querySelector('meta[property="og:description"]').setAttribute("content",desc);
    document.querySelector('meta[property="og:url"]').setAttribute("content",canonical);
    document.querySelector('meta[name="twitter:title"]').setAttribute("content",p.title);
    document.querySelector('meta[name="twitter:description"]').setAttribute("content",desc);
    if(p.cover_image){document.querySelector('meta[property="og:image"]').setAttribute("content",p.cover_image);document.querySelector('meta[name="twitter:image"]').setAttribute("content",p.cover_image);}
    let canonicalLink=document.querySelector('link[rel="canonical"]');
    if(!canonicalLink){canonicalLink=document.createElement("link");canonicalLink.rel="canonical";document.head.appendChild(canonicalLink);}
    canonicalLink.href=canonical;

    const date=formatDate(p.published_at);
    const updated=formatDate(p.updated_at);
    const author=p.author_name||"Nexauren";
    const content=sanitizeContent(normalizeContent(p.content));

    root.innerHTML=`<div class="layout">
      <div>
        <header class="article-head">
          <div class="breadcrumbs"><a href="/blog/">Blog</a> <span>›</span> ${esc(p.category_name||"Nexauren")}</div>
          <div class="meta"><span>${esc(p.category_name||"Nexauren")}</span><span>·</span><span>${esc(p.type||"article")}</span>${p.reading_time?`<span>·</span><span>${p.reading_time} min read</span>`:""}</div>
          <h1 class="title">${esc(p.title)}</h1>
          ${p.excerpt?`<p class="excerpt">${esc(p.excerpt)}</p>`:""}
          <div class="byline">By <strong>${esc(author)}</strong>${date?`<span>·</span><span>${esc(date)}</span>`:""}${updated&&updated!==date?`<span>·</span><span>Updated ${esc(updated)}</span>`:""}</div>
        </header>
        ${p.cover_image?`<div class="cover"><img src="${attr(p.cover_image)}" alt="${attr(p.cover_image_alt||p.title)}"></div>`:""}
        <article class="content">${content}</article>
        <div class="share" id="share"></div>
        <section class="related" id="related"></section>
      </div>
      <aside class="toc" aria-label="Table of contents"></aside>
    </div>`;

    makeToc();
    setupShare(p);
    relatedPosts(p);
    addSchema(p,canonical);
  }catch(e){
    root.innerHTML='<div class="error"><h1>Article not found</h1><p class="excerpt">This article may have been removed or is not published yet.</p><a class="back" href="/blog/">← Back to Blog</a></div>';
  }
}

topButton?.addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}));
window.addEventListener("scroll",updateProgress,{passive:true});
updateProgress();
load();
