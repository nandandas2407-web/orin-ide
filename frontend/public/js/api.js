'use strict';
const API={
  async getProjects(){return(await fetch('/api/files/projects')).json()},
  async createProject(n){return(await fetch('/api/files/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n})})).json()},
  async deleteProject(n){return(await fetch(`/api/files/projects/${encodeURIComponent(n)}`,{method:'DELETE'})).json()},
  async getTree(p){return(await fetch(`/api/files/${encodeURIComponent(p)}/tree`)).json()},
  async readFile(p,f){return(await fetch(`/api/files/${encodeURIComponent(p)}/file?path=${encodeURIComponent(f)}`)).json()},
  async writeFile(p,f,c){return(await fetch(`/api/files/${encodeURIComponent(p)}/file`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:f,content:c})})).json()},
  async writeBatch(p,files){return(await fetch(`/api/files/${encodeURIComponent(p)}/files/batch`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({files})})).json()},
  async readAllFiles(p){return(await fetch(`/api/files/${encodeURIComponent(p)}/files/batch-read`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).json()},
  async applyPatch(p,filePath,hunks){return(await fetch(`/api/files/${encodeURIComponent(p)}/files/patch`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:filePath,hunks})})).json()},
  async deleteFile(p,f){return(await fetch(`/api/files/${encodeURIComponent(p)}/file?path=${encodeURIComponent(f)}`,{method:'DELETE'})).json()},
  async createFolder(p,f){return(await fetch(`/api/files/${encodeURIComponent(p)}/folder`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:f})})).json()},
  async renameFile(p,o,n){return(await fetch(`/api/files/${encodeURIComponent(p)}/rename`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({oldPath:o,newPath:n})})).json()},
  async execCmd(cmd,proj){return(await fetch('/api/terminal/exec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:cmd,project:proj})})).json()},
  exportZipUrl(p){return`/api/export/${encodeURIComponent(p)}/zip`},
  async exportTermux(p,dir){return(await fetch(`/api/export/${encodeURIComponent(p)}/termux`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({targetDir:dir})})).json()},
  async importZip(file,name){
    const fd=new FormData();fd.append('zipfile',file);
    const url='/api/export/import'+(name?`?project=${encodeURIComponent(name)}`:'');
    return(await fetch(url,{method:'POST',body:fd})).json();
  },
  async uploadAsset(proj,file,destPath){const fd=new FormData();fd.append('asset',file);if(destPath)fd.append('path',destPath);return(await fetch(`/api/files/${encodeURIComponent(proj)}/asset`,{method:'POST',body:fd})).json();},
  assetUrl(proj,filePath){return`/api/files/${encodeURIComponent(proj)}/asset?path=${encodeURIComponent(filePath)}`;},
  async callAI(messages,onChunk,signal){
    const s=Cfg.all();
    if(!s.apiKey)throw new Error('No API key. Set it in Settings.');
    const model=s.model||'z-ai/glm-4.5-air:free';
    const res=await fetch('https://openrouter.ai/api/v1/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${s.apiKey}`,'HTTP-Referer':location.origin,'X-Title':'OrinIDE'},
      body:JSON.stringify({model,messages,stream:true,temperature:0.2,max_tokens:8192}),
      signal
    });
    if(!res.ok){
      let errMsg=`API error ${res.status}`;
      try{
        const e=await res.json();
        errMsg=e.error?.message||e.message||errMsg;
        if(res.status===401)errMsg='Invalid API key. Please check your OpenRouter key in Settings.';
        else if(res.status===429)errMsg='Rate limit reached. Please wait a moment and try again.';
        else if(res.status===400)errMsg=`Model "${model}" returned an error: ${errMsg}`;
      }catch(ex){}
      throw new Error(errMsg);
    }
    const reader=res.body.getReader();const dec=new TextDecoder();let full='';
    while(true){
      const{done,value}=await reader.read();if(done)break;
      for(const line of dec.decode(value,{stream:true}).split('\n')){
        if(!line.startsWith('data: '))continue;
        const d=line.slice(6).trim();if(d==='[DONE]')break;
        try{const delta=JSON.parse(d).choices?.[0]?.delta?.content;if(delta){full+=delta;if(onChunk)onChunk(delta,full)}}catch{}
      }
    }
    return full;
  }
};
