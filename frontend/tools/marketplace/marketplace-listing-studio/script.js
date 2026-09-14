const $=id=>document.getElementById(id);
const state={title:"",description:"",features:[],tags:[],faq:[],version:0};
function clean(value){return value.trim().replace(/\s+/g," ")}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]))}
const styles={
  Professional:{
    titles:[name=>`${name} — Practical Choice for Everyday Use`,name=>`${name} — Reliable Features, Simple Experience`,name=>`${name} — Designed for Everyday Value`],
    openings:[(name,a)=>`${name} is a practical choice for ${a.toLowerCase()} who want useful features and a straightforward experience.`,(name,a)=>`Discover ${name}, created for ${a.toLowerCase()} looking for a dependable and easy-to-understand product.`]
  },
  Friendly:{
    titles:[name=>`Meet ${name} — Made for Everyday Moments`,name=>`${name} — Simple, Useful and Ready to Go`,name=>`${name} — A Smart Pick for Everyday Use`],
    openings:[(name,a)=>`Meet ${name}, a simple and useful option for ${a.toLowerCase()}.`,(name)=>`Looking for something practical? ${name} brings useful features together in an easy-to-enjoy experience.`]
  },
  Premium:{
    titles:[name=>`${name} — A Refined Everyday Choice`,name=>`${name} — Premium Features, Clean Experience`,name=>`${name} — Crafted for a Better Experience`],
    openings:[(name,a)=>`${name} brings together thoughtful features and a polished experience for ${a.toLowerCase()} who expect more from everyday products.`,(name,a)=>`Designed with a refined approach, ${name} gives ${a.toLowerCase()} a dependable product experience with a clear focus on quality and usability.`]
  },
  Simple:{
    titles:[name=>`${name} — Simple and Useful`,name=>`${name} — Easy to Use, Ready for Everyday Life`,name=>`${name} — Useful Features Without the Complexity`],
    openings:[(name,a)=>`${name} is made for ${a.toLowerCase()} who want useful features without unnecessary complexity.`,(name,a)=>`${name} keeps the experience clear and practical for ${a.toLowerCase()}.`]
  }
};
function makeTags(name,category,features){
  const words=(name+" "+category+" "+features.join(" ")).toLowerCase().match(/[a-z0-9À-ÿ]+/gi)||[];
  const stop=new Set(["the","and","for","with","from","this","that","your","one","per","com","uma","para","que","dos","das"]);
  const unique=[];
  for(const word of words){if(word.length<4||stop.has(word)||unique.includes(word))continue;unique.push(word);if(unique.length===10)break}
  return unique;
}
function makeDescription(name,details,audience,tone,features,version){
  const style=styles[tone]||styles.Professional;
  const opening=style.openings[(version-1)%style.openings.length](name,audience);
  const featureLine=features.length?` Key highlights include ${features.slice(0,4).join(", ")}.`:" It focuses on a clear, practical product experience.";
  const extra=details?` ${details}.`:" Review the specifications and compatibility before publishing.";
  return opening+featureLine+extra;
}
function render(){
  $("outTitle").textContent=state.title;
  $("outDescription").textContent=state.description;
  $("outFeatures").innerHTML=state.features.map(item=>`<li>${escapeHtml(item)}</li>`).join("");
  $("outTags").innerHTML=state.tags.map(tag=>`<span class="tag">${escapeHtml(tag)}</span>`).join("");
  $("outFaq").innerHTML=state.faq.map(item=>`<div class="faq"><strong>${escapeHtml(item.q)}</strong><span>${escapeHtml(item.a)}</span></div>`).join("");
  $("empty").hidden=true;$("result").hidden=false;$("copy").disabled=false;
}
function generate(){
  const name=clean($("name").value);
  if(!name){$("status").className="status error";$("status").textContent="Add a product name to continue.";$("name").focus();return}
  const category=clean($("category").value);
  const features=$("features").value.split(/\n|,/).map(clean).filter(Boolean).slice(0,8);
  const details=clean($("details").value),audience=$("audience").value,tone=$("tone").value;
  state.version+=1;
  const style=styles[tone]||styles.Professional;
  const titleFactory=style.titles[(state.version-1)%style.titles.length];
  state.title=titleFactory(name)+(category?` — ${category}`:"");
  state.description=makeDescription(name,details,audience,tone,features,state.version);
  state.features=features.length?features:["Designed for straightforward everyday use","Clear product presentation","Practical value for the intended customer"];
  state.tags=makeTags(name,category,features);
  state.faq=[
    {q:"What is this product?",a:`${name} is a ${category||"practical product"} designed for ${audience.toLowerCase()}.`},
    {q:"Who is it for?",a:`It is suitable for ${audience.toLowerCase()} looking for a clear, useful solution.`},
    {q:"What should I check before publishing?",a:"Confirm specifications, compatibility, availability, pricing and any claims against the actual product."}
  ];
  render();
  $("status").className="status success";
  $("status").textContent=state.version===1?"Listing generated. Click again to create another version.":`Version ${state.version} generated. Keep generating until you find the one you like.`;
  $("generate").textContent="Generate another version";
}
$("generate").addEventListener("click",generate);
$("copy").addEventListener("click",async()=>{
  const text=[state.title,"",state.description,"","KEY FEATURES",...state.features.map(x=>`• ${x}`),"","TAGS",state.tags.join(", "),"","FAQ",...state.faq.flatMap(x=>[x.q,x.a])].join("\n");
  try{await navigator.clipboard.writeText(text);$("status").className="status success";$("status").textContent="Listing copied to clipboard."}
  catch{$("status").className="status error";$("status").textContent="Copy is unavailable in this browser."}
});
$("features").addEventListener("keydown",event=>{if(event.key==="Enter"&&!event.shiftKey)event.stopPropagation()});
