const root=document.querySelector("#article");
const slug=decodeURIComponent(location.pathname.replace(/^\/blog\//,"" ).replace(/\/$/,""));
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
function safeContent(v){return String(v??"");}
async function load(){
  if(!slug){root.textContent="Article not found.";return;}
  try{
    const res=await fetch(`/api/blog/posts/${encodeURIComponent(slug)}`);
    if(!res.ok)throw new Error("not found");
    const data=await res.json();
    const p=data.post||data;
    if(!p?.title)throw new Error("not found");
    document.title=`${p.seo_title||p.title} — Nexauren`;
    const desc=p.seo_description||p.excerpt||"Nexauren Blog article";
    document.querySelector('meta[name="description"]').setAttribute("content",desc);
    root.innerHTML=`<div class="meta">${esc(p.category_name||"Nexauren")} <span>·</span> ${esc(p.type||"article")} ${p.reading_time?`<span>·</span> ${p.reading_time} min read`:""}</div>
      <h1 class="title">${esc(p.title)}</h1>
      ${p.excerpt?`<p class="excerpt">${esc(p.excerpt)}</p>`:""}
      ${p.cover_image?`<div class="cover"><img src="${esc(p.cover_image)}" alt="${esc(p.cover_image_alt||p.title)}"></div>`:""}
      <article class="content">${safeContent(p.content)}</article>`;
  }catch(e){root.innerHTML='<h1>Article not found</h1><p class="excerpt">This article may have been removed or is not published yet.</p><a class="back" href="/blog/">← Back to Blog</a>';}
}
load();
