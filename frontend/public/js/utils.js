'use strict';
/* ======= TOAST ======= */
function toast(msg, type='inf', dur=3000){
  const c=document.getElementById('toasts');
  const d=document.createElement('div');
  d.className='toast '+type; d.textContent=msg; c.appendChild(d);
  setTimeout(()=>{d.style.opacity='0';d.style.transition='opacity .25s';setTimeout(()=>d.remove(),250)},dur);
}
function showLoading(t='Working...'){document.getElementById('loading-txt').textContent=t;document.getElementById('loading').classList.remove('hidden')}
function hideLoading(){document.getElementById('loading').classList.add('hidden')}
function openModal(id){document.getElementById(id).classList.remove('hidden')}
function closeModal(id){document.getElementById(id).classList.add('hidden')}

/* ======= FILE ICONS (text only, no emoji) ======= */
function fileIcon(name){
  const e=(name.split('.').pop()||'').toLowerCase();
  const m={js:'JS',ts:'TS',jsx:'JSX',tsx:'TSX',html:'HTM',htm:'HTM',css:'CSS',scss:'SCS',
    json:'{}',md:'MD',txt:'TXT',py:'PY',rb:'RB',php:'PHP',java:'JV',cpp:'C++',c:'C',
    go:'GO',rs:'RS',sh:'SH',bash:'SH',sql:'SQL',xml:'XML',yaml:'YML',yml:'YML',
    env:'ENV',png:'IMG',jpg:'IMG',jpeg:'IMG',gif:'GIF',svg:'SVG',zip:'ZIP',pdf:'PDF'};
  return m[e]||'FILE';
}

/* ======= LANGUAGE MAP ======= */
function langFromExt(fn){
  const e=(fn.split('.').pop()||'').toLowerCase();
  const m={js:'javascript',ts:'typescript',jsx:'javascript',tsx:'typescript',
    html:'html',htm:'html',css:'css',scss:'scss',sass:'scss',json:'json',
    md:'markdown',py:'python',rb:'ruby',php:'php',java:'java',cpp:'cpp',
    c:'c',go:'go',rs:'rust',sh:'shell',bash:'shell',sql:'sql',xml:'xml',
    yaml:'yaml',yml:'yaml',env:'plaintext',txt:'plaintext'};
  return m[e]||'plaintext';
}

/* ======= SETTINGS ======= */
const Cfg = {
  get(k,d){try{const v=localStorage.getItem('ci_'+k);return v!==null?JSON.parse(v):d}catch{return d}},
  set(k,v){try{localStorage.setItem('ci_'+k,JSON.stringify(v))}catch{}},
  all(){return{
    apiKey:this.get('apiKey',''), model:this.get('model','openrouter/free'),
    fontSize:this.get('fontSize',14), tabSize:this.get('tabSize',2),
    wordWrap:this.get('wordWrap',true), minimap:this.get('minimap',false),
    autosave:this.get('autosave',false), exportPath:this.get('exportPath','/storage/emulated/0/')
  }},
  save(o){Object.entries(o).forEach(([k,v])=>this.set(k,v))}
};

function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}}

async function copyText(text){
  try{await navigator.clipboard.writeText(text);toast('Copied','ok',1200)}
  catch{const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();toast('Copied','ok',1200)}
}

function setHint(text){document.getElementById('chat-input').value=text;document.getElementById('chat-input').focus()}

/* ======= PARSE AI FILES ======= */
function parseFiles(content){
  const files=[];
  // Primary: ```lang:path\ncontent\n```
  const re=/```[\w]*:([^\n`]+)\n([\s\S]*?)```/g;
  let m;
  while((m=re.exec(content))!==null){
    const p=m[1].trim();
    if(p&&(p.includes('.')||p.includes('/')))files.push({path:p,content:m[2]});
  }
  // Fallback: ### FILE: path
  if(!files.length){
    const re2=/(?:###?\s*FILE:\s*|\/\/\s*FILE:\s*)([^\n]+)\n[\s\S]*?```[\w]*\n([\s\S]*?)```/g;
    while((m=re2.exec(content))!==null)files.push({path:m[1].trim(),content:m[2]});
  }
  return files;
}

/* ======= MARKDOWN RENDERER ======= */
function renderMD(text){
  if(!text)return'';
  let html='';
  const lines=text.split('\n');
  let inCode=false,cLang='',cPath='',cLines=[];

  const flushCode=()=>{
    const escaped=cLines.join('\n').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const hdr=`<div class="cb-header">
      <span class="cb-lang">${esc(cLang)}</span>
      ${cPath?`<span class="cb-path">${esc(cPath)}</span>`:''}
      <button class="cb-copy" onclick="copyText(${JSON.stringify(cLines.join('\n'))})">Copy</button>
    </div>`;
    html+=`<pre>${hdr}<code>${escaped}</code></pre>`;
    cLines=[];cLang='';cPath='';
  };

  for(const line of lines){
    if(!inCode&&line.startsWith('```')){
      inCode=true;
      const meta=line.slice(3).trim();
      const ci=meta.indexOf(':');
      if(ci>-1){cLang=meta.slice(0,ci);cPath=meta.slice(ci+1);}
      else{cLang=meta;cPath='';}
      continue;
    }
    if(inCode){
      if(line==='```'||line.startsWith('```')){inCode=false;flushCode();}
      else cLines.push(line);
      continue;
    }
    let l=line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g,'<em>$1</em>')
      .replace(/`([^`]+)`/g,'<code>$1</code>');
    if(/^### /.test(l))html+=`<h3 style="margin:8px 0 4px;font-size:13px;color:var(--tx0)">${l.slice(4)}</h3>`;
    else if(/^## /.test(l))html+=`<h2 style="margin:9px 0 4px;font-size:14px;color:var(--tx0)">${l.slice(3)}</h2>`;
    else if(/^# /.test(l))html+=`<h1 style="margin:10px 0 5px;font-size:15px;color:var(--tx0)">${l.slice(2)}</h1>`;
    else if(/^[\-\*] /.test(l))html+=`<div style="margin:2px 0 2px 12px">&bull; ${l.slice(2)}</div>`;
    else if(/^\d+\. /.test(l))html+=`<div style="margin:2px 0 2px 12px">${l}</div>`;
    else if(l.trim()==='')html+=`<div style="height:5px"></div>`;
    else html+=`<p>${l}</p>`;
  }
  if(inCode)flushCode();
  return html;
}

function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

function flatTree(tree,out=[]){for(const i of(tree||[])){out.push(i);if(i.children)flatTree(i.children,out);}return out}
