'use strict';
/* ======= TOAST ======= */
let _toastCount = 0;
function toast(msg, type='inf', dur=3000){
  const c=document.getElementById('toasts');
  if (!c) return;
  const d=document.createElement('div');
  d.className='toast '+type; d.textContent=msg;
  d.style.animation = 'toastSlideIn .25s cubic-bezier(0.16,1,0.3,1)';
  c.appendChild(d);
  _toastCount++;
  // Auto-remove with fade
  setTimeout(()=>{
    d.style.opacity='0';
    d.style.transform='translateY(-4px)';
    d.style.transition='opacity .25s, transform .25s';
    setTimeout(()=>{ d.remove(); _toastCount--; }, 250);
  }, dur);
  // Click to dismiss
  d.addEventListener('click', () => {
    d.style.opacity='0';
    d.style.transform='translateY(-4px)';
    d.style.transition='opacity .15s, transform .15s';
    setTimeout(()=>{ d.remove(); _toastCount--; }, 150);
  }, { once: true });
}
function showLoading(t='Working...'){
  const el = document.getElementById('loading');
  const txt = document.getElementById('loading-txt');
  if (txt) txt.textContent = t;
  if (el) el.classList.remove('hidden');
}
function hideLoading(){document.getElementById('loading')?.classList.add('hidden')}
function openModal(id){document.getElementById(id)?.classList.remove('hidden')}
function closeModal(id){document.getElementById(id)?.classList.add('hidden')}

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
    autosave:this.get('autosave',false), formatOnSave:this.get('formatOnSave',false),
    exportPath:this.get('exportPath','/storage/emulated/0/')
  }},
  save(o){Object.entries(o).forEach(([k,v])=>this.set(k,v))}
};
window.Cfg = Cfg;

function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}}

/* ======= UTILITY FUNCTIONS ======= */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
}

function truncate(str, len = 50) {
  if (!str || str.length <= len) return str;
  return str.slice(0, len) + '...';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function copyText(text){
  try{
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard','ok',1200);
  } catch {
    // Fallback for older browsers
    const t=document.createElement('textarea');
    t.value=text;
    t.style.cssText='position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(t);
    t.select();
    try {
      document.execCommand('copy');
      toast('Copied to clipboard','ok',1200);
    } catch {
      toast('Failed to copy','err',2000);
    }
    t.remove();
  }
}

function setHint(text){
  const inp = document.getElementById('chat-input');
  if (inp) { inp.value=text; inp.focus(); }
}

/* ======= PARSE AI FILES ======= */
function parseFiles(content){
  const files=[];
  const seen=new Set();
  // Primary: ```lang:path\ncontent\n```  (tolerates extra spaces around lang and path)
  const re=/```[\s]*([\w]+)[\s]*:([^\n`]+)\n([\s\S]*?)```/g;
  let m;
  while((m=re.exec(content))!==null){
    const p=m[2].trim();
    if(p&&(p.includes('.')||p.includes('/'))&&!seen.has(p)){seen.add(p);files.push({path:p,content:m[3]});}
  }
  // Fallback: ### FILE: path
  if(!files.length){
    const re2=/(?:###?\s*FILE:\s*|\/\/\s*FILE:\s*)([^\n]+)\n[\s\S]*?```[\w]*\n([\s\S]*?)```/g;
    while((m=re2.exec(content))!==null){const p=m[1].trim();if(!seen.has(p)){seen.add(p);files.push({path:p,content:m[2]});}}
  }
  // Fallback: detect ```lang\n...``` without path — infer filename from language
  if(!files.length){
    const re3=/```([\w]+)\n([\s\S]*?)```/g;
    const extMap={js:'js',javascript:'js',py:'py',python:'py',html:'html',htm:'html',css:'css',json:'json',ts:'ts',typescript:'ts',tsx:'tsx',jsx:'jsx',java:'java',c:'c',cpp:'cpp',cs:'cs',go:'go',rs:'rs',rb:'rb',php:'php',sh:'sh',bash:'sh',sql:'sql',xml:'xml',yaml:'yaml',yml:'yaml',scss:'scss',less:'less',svelte:'svelte',vue:'vue'};
    let idx=0;
    while((m=re3.exec(content))!==null){
      const lang=m[1].trim().toLowerCase();
      const code=m[2];
      const ext=extMap[lang]||lang;
      if(code.trim().length>5){
        const path=`file${idx>0?idx:''}.${ext}`;
        if(!seen.has(path)){seen.add(path);files.push({path,content:code});idx++;}
      }
    }
  }
  // Fallback: detect ```\n...``` without any language — extract as file
  if(!files.length){
    const re4=/```\n([\s\S]*?)```/g;
    let idx=0;
    while((m=re4.exec(content))!==null){
      const code=m[1];
      if(code.trim().length>20){
        const path=`output${idx>0?idx:''}.txt`;
        if(!seen.has(path)){seen.add(path);files.push({path,content:code});idx++;}
      }
    }
  }
  return files;
}

/* ======= PARSE AI PATCH BLOCKS ======= */
// Parses @@patch blocks from AI response.
// Format:
//   @@patch:path/to/file.ext
//   <<<search
//   exact text to find
//   ===
//   replacement text
//   >>>
//   (repeat for more hunks in same file)
//
// Returns [{ path, hunks: [{ search, replace }] }]
function parsePatches(content) {
  const results = [];
  // Split on @@patch: markers
  const patchRe = /@@patch:([^\n]+)\n([\s\S]*?)(?=@@patch:|$)/g;
  // Flexible hunk regex — tolerates spaces after <<< and optional trailing newline before >>>
  const hunkRe = /<<<[\s]*search\s*\n([\s\S]*?)\n===\s*\n([\s\S]*?)\n\s*>>>/g;
  let pm;
  while ((pm = patchRe.exec(content)) !== null) {
    const filePath = pm[1].trim();
    if (!filePath) continue;
    const body = pm[2];
    const hunks = [];
    let hm;
    hunkRe.lastIndex = 0;
    while ((hm = hunkRe.exec(body)) !== null) {
      hunks.push({ search: hm[1], replace: hm[2] });
    }
    if (hunks.length > 0) results.push({ path: filePath, hunks });
  }
  return results;
}

// Convert full file output to @@patch format by diffing against current file content
// Handles: ```lang:file, ```file, ```lang (bare), and even raw text resembling a file
function convertFullFileToPatch(aiOutput, currentFiles) {
  if (!aiOutput || !currentFiles || Object.keys(currentFiles).length === 0) return aiOutput;

  let hasPatch = /@@patch:/.test(aiOutput);
  if (hasPatch) return aiOutput;

  const convertedParts = [];
  let lastIndex = 0;
  let anyConverted = false;

  // Strategy 1: Match ```lang:filepath fences
  const fileRe = /```[\s]*([\w]+)[\s]*:([^\n`]+)\n([\s\S]*?)```/g;
  let match;
  while ((match = fileRe.exec(aiOutput)) !== null) {
    const filePath = match[2].trim();
    const newContent = match[3];
    const patch = tryDiffAndPatch(filePath, newContent, currentFiles);
    if (patch) {
      convertedParts.push(aiOutput.slice(lastIndex, match.index));
      convertedParts.push(patch);
      lastIndex = match.index + match[0].length;
      anyConverted = true;
    }
  }

  if (anyConverted) {
    convertedParts.push(aiOutput.slice(lastIndex));
    return convertedParts.join('');
  }

  // Strategy 2: Match ```filepath fences (no lang prefix)
  const bareFileRe = /```([^\n`]+)\n([\s\S]*?)```/g;
  while ((match = bareFileRe.exec(aiOutput)) !== null) {
    const possiblePath = match[1].trim();
    const newContent = match[2];
    // Check if it looks like a file path (has extension or matches a known file)
    if (possiblePath.includes('.') || currentFiles[possiblePath]) {
      const patch = tryDiffAndPatch(possiblePath, newContent, currentFiles);
      if (patch) {
        convertedParts.push(aiOutput.slice(lastIndex, match.index));
        convertedParts.push(patch);
        lastIndex = match.index + match[0].length;
        anyConverted = true;
      }
    }
  }

  if (anyConverted) {
    convertedParts.push(aiOutput.slice(lastIndex));
    return convertedParts.join('');
  }

  // Strategy 3: Match bare ```lang or ``` fences where content closely resembles a known file
  const bareCodeRe = /```(\w*)\n([\s\S]*?)```/g;
  while ((match = bareCodeRe.exec(aiOutput)) !== null) {
    const lang = match[1];
    const newContent = match[2];
    if (newContent.trim().length < 20) continue;
    // Try to find which file this resembles by line overlap
    const bestMatch = findBestFileMatch(newContent, currentFiles);
    if (bestMatch) {
      const patch = tryDiffAndPatch(bestMatch.path, newContent, currentFiles);
      if (patch) {
        convertedParts.push(aiOutput.slice(lastIndex, match.index));
        convertedParts.push(patch);
        lastIndex = match.index + match[0].length;
        anyConverted = true;
      }
    }
  }

  if (anyConverted) {
    convertedParts.push(aiOutput.slice(lastIndex));
    return convertedParts.join('');
  }

  // Strategy 4: No fences at all — look for large blocks of text that resemble a file
  // Split by double newlines, check each paragraph
  const paragraphs = aiOutput.split(/\n\n+/);
  let paraStart = 0;
  for (const para of paragraphs) {
    if (para.trim().length < 30) { paraStart += para.length + 2; continue; }
    const bestMatch = findBestFileMatch(para, currentFiles);
    if (bestMatch && bestMatch.score > 0.5) {
      const patch = tryDiffAndPatch(bestMatch.path, para, currentFiles);
      if (patch) {
        const idx = aiOutput.indexOf(para, paraStart);
        if (idx !== -1) {
          convertedParts.push(aiOutput.slice(lastIndex, idx));
          convertedParts.push(patch);
          lastIndex = idx + para.length;
          anyConverted = true;
        }
      }
    }
    paraStart += para.length + 2;
  }

  if (anyConverted) {
    convertedParts.push(aiOutput.slice(lastIndex));
    return convertedParts.join('');
  }

  return aiOutput;
}

// Try to diff newContent against a known file and generate a patch
function tryDiffAndPatch(filePath, newContent, currentFiles) {
  // Clean up content: remove trailing ``` that might be part of closing fence
  let cleaned = newContent.replace(/\n```$/, '').replace(/\r/g, '');
  // Try exact match first, then fuzzy
  const currentContent = currentFiles[filePath];
  if (!currentContent) return null;
  if (cleaned.trim() === currentContent.trim()) return null; // No changes
  return generatePatch(filePath, currentContent, cleaned);
}

// Find which known file best matches a block of text by line overlap
function findBestFileMatch(text, currentFiles) {
  const textLines = text.split('\n').filter(l => l.trim().length > 0);
  if (textLines.length < 3) return null;

  let best = null;
  let bestScore = 0;

  for (const [path, content] of Object.entries(currentFiles)) {
    const fileLines = content.split('\n');
    let matches = 0;
    for (const tl of textLines) {
      const trimmed = tl.trim();
      if (trimmed.length < 5) continue; // skip very short lines
      if (fileLines.some(fl => fl.trim() === trimmed)) matches++;
    }
    const score = matches / textLines.length;
    if (score > bestScore) {
      bestScore = score;
      best = { path, score };
    }
  }

  return bestScore >= 0.4 ? best : null; // at least 40% line overlap
}

// Generate @@patch hunks by diffing old vs new content line by line
function generatePatch(filePath, oldContent, newContent) {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const hunks = lcsDiff(oldLines, newLines);

  if (hunks.length === 0) return null;

  let patch = `@@patch:${filePath}\n`;
  for (const h of hunks) {
    patch += `<<<search\n${h.search}\n===\n${h.replace}\n>>>\n`;
  }
  return patch;
}

// LCS-based diff: finds ALL changed regions with context
function lcsDiff(oldLines, newLines) {
  const m = oldLines.length, n = newLines.length;

  // For very large files, fall back to simple prefix/suffix diff
  if (m > 2000 || n > 2000) return simpleDiff(oldLines, newLines);

  // Build LCS table
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to find changed regions
  const changes = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      // new line added
      j--;
      changes.unshift({ type: 'add', oldIdx: i, newIdx: j });
    } else {
      // old line removed
      i--;
      changes.unshift({ type: 'del', oldIdx: i, newIdx: j });
    }
  }

  // Group adjacent changes into hunks with context
  const hunks = [];
  const ctx = 2;
  let idx = 0;
  while (idx < changes.length) {
    // Find range of adjacent changes
    let start = idx;
    let end = idx;
    while (end + 1 < changes.length) {
      const curr = changes[end];
      const next = changes[end + 1];
      // Adjacent if within 3 lines of each other
      if (next.oldIdx - curr.oldIdx <= 3 && next.newIdx - curr.newIdx <= 3) {
        end++;
      } else break;
    }

    // Determine old and new ranges for this hunk
    let oldStart = changes[start].oldIdx;
    let oldEnd = changes[end].oldIdx + 1;
    let newStart = changes[start].newIdx;
    let newEnd = changes[end].newIdx + 1;

    // Handle additions (no old lines removed)
    const hasDel = changes.slice(start, end + 1).some(c => c.type === 'del');
    const hasAdd = changes.slice(start, end + 1).some(c => c.type === 'add');

    if (!hasDel && hasAdd) {
      // Pure addition: insert after oldStart-1
      oldStart = changes[start].oldIdx;
      oldEnd = oldStart;
    }

    // Add context
    const ctxOldStart = Math.max(0, oldStart - ctx);
    const ctxOldEnd = Math.min(oldLines.length, oldEnd + ctx);

    const searchLines = oldLines.slice(ctxOldStart, ctxOldEnd);
    const replaceLines = [
      ...oldLines.slice(ctxOldStart, oldStart),
      ...newLines.slice(newStart, newEnd),
      ...oldLines.slice(oldEnd, ctxOldEnd)
    ];

    const search = searchLines.join('\n');
    const replace = replaceLines.join('\n');

    if (search !== replace) {
      hunks.push({ search, replace });
    }

    idx = end + 1;
  }

  return hunks;
}

// Simple prefix/suffix diff for large files (fallback)
function simpleDiff(oldLines, newLines) {
  let prefixLen = 0;
  while (prefixLen < oldLines.length && prefixLen < newLines.length && oldLines[prefixLen] === newLines[prefixLen]) {
    prefixLen++;
  }
  let suffixLen = 0;
  while (
    suffixLen < Math.min(oldLines.length, newLines.length) - prefixLen &&
    oldLines[oldLines.length - 1 - suffixLen] === newLines[newLines.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const oldStart = prefixLen;
  const oldEnd = oldLines.length - suffixLen;
  const newStart = prefixLen;
  const newEnd = newLines.length - suffixLen;

  if (oldStart >= oldEnd && newStart >= newEnd) return [];

  const ctx = 2;
  const ctxOldStart = Math.max(0, oldStart - ctx);
  const ctxOldEnd = Math.min(oldLines.length, oldEnd + ctx);

  const searchLines = oldLines.slice(ctxOldStart, ctxOldEnd);
  const replaceLines = [
    ...oldLines.slice(ctxOldStart, oldStart),
    ...newLines.slice(newStart, newEnd),
    ...oldLines.slice(oldEnd, ctxOldEnd)
  ];

  return [{ search: searchLines.join('\n'), replace: replaceLines.join('\n') }];
}

// Parses @@cmd: lines from AI output — shell commands to execute
function parseCommands(content) {
  const cmds = [];
  const re = /@@cmd:(.+)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const cmd = m[1].trim();
    if (cmd && !cmds.includes(cmd)) cmds.push(cmd);
  }
  return cmds;
}


function renderMD(text){
  if(!text)return'';
  let html='';
  const lines=text.split('\n');
  let inCode=false,cLang='',cPath='',cLines=[];

  const escHtml=(s)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const flushCode=(partial=false)=>{
    const content=cLines.join('\n');
    const escaped=escHtml(content);
    const streamTag=partial?'<span class="cb-streaming">generating...</span>':'';
    const isHtml=(cLang.toLowerCase()==='html'||cPath.toLowerCase().endsWith('.html'));
    const previewBtn=(!partial&&isHtml)
      ?`<button class="cb-copy cb-preview-html" onclick="ChatHTMLPreview.show(this.closest('pre').querySelector('code').textContent)">Preview</button>`
      :'';
    const langLabel=cLang?`<span class="cb-lang">${escHtml(cLang)}</span>`:'';
    const pathLabel=cPath?`<span class="cb-path" title="${escHtml(cPath)}">${escHtml(cPath)}</span>`:'';
    const hdr=`<div class="cb-header">
      <div class="cb-header-left">${langLabel}${pathLabel}</div>
      <div class="cb-header-right">
        ${streamTag}
        ${!partial?`<button class="cb-copy" onclick="copyText(this.closest('pre').querySelector('code').textContent);this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',1500)">Copy</button>`:''}
        ${previewBtn}
      </div>
    </div>`;
    html+=`<pre class="cb-pre">${hdr}<code class="cb-code">${escaped}</code></pre>`;
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
      if(line.trimEnd()==='```'){inCode=false;flushCode(false);}
      else cLines.push(line);
      continue;
    }
    let l=escHtml(line)
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
  if(inCode)flushCode(true);
  return html;
}

/* ======= CHAT HTML PREVIEW (renders HTML output inside modal iframe) ======= */
const ChatHTMLPreview = {
  show(htmlContent) {
    let modal = document.getElementById('chat-html-preview-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'chat-html-preview-modal';
      modal.className = 'modal-bg';
      modal.style.cssText = 'z-index:2000';
      modal.innerHTML = `
        <div class="modal-box preview-box">
          <div class="modal-head">
            <span>HTML Preview</span>
            <div style="display:flex;gap:6px;align-items:center">
              <button class="ib sm" id="chat-html-new-tab" title="Open in new tab">New Tab</button>
              <button class="ib sm modal-x" id="chat-html-close">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <iframe id="chat-html-frame" class="preview-frame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
        </div>`;
      document.body.appendChild(modal);
      document.getElementById('chat-html-close').addEventListener('click', () => modal.classList.add('hidden'));
      modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
    }
    const frame = document.getElementById('chat-html-frame');
    frame.srcdoc = htmlContent;
    document.getElementById('chat-html-new-tab').onclick = () => {
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    };
    modal.classList.remove('hidden');
  }
};

function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

function flatTree(tree,out=[]){for(const i of(tree||[])){out.push(i);if(i.children)flatTree(i.children,out);}return out}

/* ======= TOKEN ESTIMATION ======= */
const TokenEst = {
  // Rough approximation: ~4 chars per token for English/code
  estimate(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  },

  // Get context window limit for a model (in tokens)
  getModelLimit(modelId) {
    const limits = {
      // Free OpenRouter models — context windows
      'openrouter/free': 16384,
      'z-ai/glm-4.5-air:free': 16384,
      'tencent/hy3-preview:free': 16384,
      'openai/gpt-oss-120b:free': 16384,
      'nvidia/nemotron-3-super-120b-a12b:free': 16384,
      'google/gemma-3-27b-it:free': 32768,
      'poolside/laguna-xs.2:free': 16384,
      'cohere/north-mini-code:free': 16384,
      // Paid OpenRouter
      'anthropic/claude-opus-4.6': 200000,
      'openai/gpt-5.5': 200000,
      'deepseek/deepseek-v4-pro': 128000,
      // Direct providers
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'o3': 200000,
      'claude-sonnet-4-6': 200000,
      'claude-opus-4-6': 200000,
      'claude-haiku-4-5-20251001': 200000,
      // Groq
      'llama-3.3-70b-versatile': 128000,
      'llama-3.1-8b-instant': 128000,
      'mixtral-8x7b-32768': 32768,
      'gemma2-9b-it': 8192,
      // Together
      'meta-llama/Llama-3-70b-chat-hf': 8192,
      'mistralai/Mixtral-8x7B-Instruct-v0.1': 32768,
      // Ollama defaults
      'llama3': 8192,
      'codellama': 16384,
      'mistral': 32768,
      'phi3': 12288,
    };
    return limits[modelId] || 8192; // default 8K
  },

  // Check if a model is a free/small context model
  isSmallContext(modelId) {
    return modelId.includes(':free') || this.getModelLimit(modelId) <= 8192;
  },

  // Calculate budget for project context (leave room for system + user + response)
  getProjectBudget(modelId) {
    const limit = this.getModelLimit(modelId);
    // Reserve: system prompt (~400 tokens now), response (~4096 tokens), user message overhead (~200 tokens)
    const reserved = this.isSmallContext(modelId) ? 2000 : 3000;
    return Math.max(0, limit - reserved);
  },

  // Truncate project context to fit within token budget
  fitContext(files, budget, userMsg) {
    const userTokens = this.estimate(userMsg);
    const available = Math.max(0, budget - userTokens);
    if (available <= 0) return { files: [], totalTokens: userTokens, truncated: true };

    let total = 0;
    const fitted = [];
    for (const f of files) {
      const fileTokens = this.estimate(`\n\`\`\`${f.ext}:${f.path}\n${f.content}\n\`\`\``);
      if (total + fileTokens > available) {
        // Try to include a truncated version
        const remaining = available - total;
        if (remaining > 100) {
          const maxChars = remaining * 4;
          const truncated = f.content.slice(0, maxChars) + '\n// ... (truncated)';
          fitted.push({ ...f, content: truncated, truncated: true });
          total += this.estimate(`\n\`\`\`${f.ext}:${f.path}\n${truncated}\n\`\`\``);
        }
        break;
      }
      fitted.push(f);
      total += fileTokens;
    }
    return { files: fitted, totalTokens: total + userTokens, truncated: fitted.length < files.length };
  },

  // Prune history to fit within token budget
  fitHistory(history, budget) {
    if (!history.length) return history;
    const system = history[0]; // always keep system
    const rest = history.slice(1);
    let total = this.estimate(system.content);
    const fitted = [system];

    // Add messages from newest to oldest until budget is exceeded
    for (let i = rest.length - 1; i >= 0; i--) {
      const msg = rest[i];
      const tokens = this.estimate(msg.content);
      if (total + tokens > budget) break;
      fitted.splice(1, 0, msg); // insert after system
      total += tokens;
    }
    return fitted;
  }
};
window.TokenEst = TokenEst;

/* ======= RESPONSE COMPLETENESS ======= */
// Single source of truth for "did the model actually finish, or get cut off?"
// Previously each chat surface (chat.js, agents.js) guessed this purely from
// text heuristics (odd fence counts, "looks like a truncated word", etc).
// That's fragile and was the main reason generations silently looked done
// when they weren't, or falsely triggered continues. The API already tells
// us this directly via finish_reason (OpenAI/OpenRouter) or stop_reason
// (Anthropic) — API.js now captures that as API._lastFinishReason after
// every call. We trust that first, and only fall back to text heuristics
// when a provider doesn't send one (some proxies/free models omit it).
const ResponseCompleteness = {
  // Finish reasons that mean "the model stopped because it ran out of room",
  // across the different provider vocabularies we talk to.
  TRUNCATED_REASONS: new Set(['length', 'max_tokens', 'max_output_tokens']),
  // Finish reasons that mean "the model chose to stop — trust it, even if
  // the text looks unusual (e.g. it legitimately ended on a short word)."
  CLEAN_REASONS: new Set(['stop', 'end_turn', 'stop_sequence', 'tool_calls', 'tool_use']),

  isIncomplete(text, finishReason) {
    if (finishReason) {
      const fr = String(finishReason).toLowerCase();
      if (this.TRUNCATED_REASONS.has(fr)) return true;
      if (this.CLEAN_REASONS.has(fr)) return false;
      // Unrecognized reason string — fall through to heuristic rather than guess.
    }
    return this._heuristic(text);
  },

  // Best-effort guess for providers that don't report a finish reason at all.
  _heuristic(text) {
    if (!text || text.length < 20) return false;
    const fences = text.match(/^```/gm) || [];
    if (fences.length % 2 !== 0) return true;
    const patches = text.match(/@@patch:\S+/g) || [];
    if (patches.length > 0) {
      const lastPatchIdx = text.lastIndexOf('@@patch:');
      const afterLastPatch = text.slice(lastPatchIdx);
      if (afterLastPatch.includes('<<<') && !afterLastPatch.includes('>>>')) return true;
    }
    const lastFenceMatch = text.match(/```[\w]*:?[^\n]*\n([\s\S]*)$/);
    if (lastFenceMatch) {
      const inside = lastFenceMatch[1];
      if (/<[a-zA-Z][^>]*$/.test(inside.trim()) && !/<\/\w+>$/.test(inside.trim())) return true;
    }
    const trimmed = text.trim();
    if (trimmed.length > 50) {
      const lastChar = trimmed.slice(-1);
      const secondLast = trimmed.slice(-2, -1);
      if (/[a-zA-Z0-9]/.test(lastChar) && /[a-zA-Z0-9]/.test(secondLast)) {
        const lastWord = trimmed.match(/\w+$/)?.[0] || '';
        if (lastWord.length >= 3 && lastWord.length <= 5) return true;
      }
    }
    return false;
  }
};
window.ResponseCompleteness = ResponseCompleteness;
