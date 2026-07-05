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
  async execCommand(cmd, project) {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${location.host}/ws`);
      const timeout = setTimeout(() => { ws.close(); reject(new Error('Command timed out')); }, 30000);
      let stdout = '', stderr = '';
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'terminal:exec', command: cmd, project: project || null }));
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'terminal:output') stdout += msg.data;
          else if (msg.type === 'terminal:done') {
            clearTimeout(timeout);
            ws.close();
            resolve({ stdout, stderr, exitCode: msg.exitCode });
          }
        } catch {}
      };
      ws.onerror = () => { clearTimeout(timeout); reject(new Error('WebSocket error')); };
    });
  },
  async searchProject(p,q,opts={}){
    const params = new URLSearchParams({ q });
    if (opts.caseSensitive) params.set('case','1');
    if (opts.wholeWord) params.set('word','1');
    if (opts.regex) params.set('regex','1');
    return (await fetch(`/api/files/${encodeURIComponent(p)}/search?${params}`)).json();
  },
  async execCmd(cmd,proj){return(await fetch('/api/terminal/exec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:cmd,project:proj})})).json()},
  exportZipUrl(p){return`/api/export-zip/${encodeURIComponent(p)}`},
  async exportTermux(p,dir){return(await fetch(`/api/export/${encodeURIComponent(p)}/termux`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({targetDir:dir})})).json()},
  async importZip(file,name){
    const b64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
    const url = '/api/import-zip?_=' + Date.now();
    const resp = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ zipData: b64, fileName: file.name, projectName: name || '' })
    });
    const text = await resp.text();
    try { return JSON.parse(text); }
    catch(e) { throw new Error('Server returned: ' + text.slice(0, 200)); }
  },
  async uploadAsset(proj,file,destPath){const fd=new FormData();fd.append('asset',file);if(destPath)fd.append('path',destPath);return(await fetch(`/api/files/${encodeURIComponent(proj)}/asset`,{method:'POST',body:fd})).json();},
  assetUrl(proj,filePath){return`/api/files/${encodeURIComponent(proj)}/asset?path=${encodeURIComponent(filePath)}`;},

  // Resolve provider and API key for a given model
  _resolveModel(modelId) {
    let provider, model;
    const allProviders = typeof Providers !== 'undefined' ? Providers.list() : [];
    
    // Direct match first
    for (const p of allProviders) {
      const m = p.models.find(m => m.id === modelId);
      if (m) { provider = p; model = m; break; }
    }
    
    // Ollama special handling: "ollama/model:tag" -> match ollama provider
    if (!provider && modelId.startsWith('ollama/')) {
      provider = allProviders.find(p => p.id === 'ollama');
      const ollamaModel = modelId.replace('ollama/', '');
      model = { id: ollamaModel, name: ollamaModel };
    }
    
    if (!provider) provider = allProviders.find(p => p.id === 'openrouter');
    return { provider, model };
  },

  // Call AI with multi-provider support
  async callAI(messages,onChunk,signal,modelOverride){
    const s=Cfg.all();
    const model=modelOverride || s.model || 'openrouter/free';
    const { provider } = this._resolveModel(model);
    const baseURL = (provider && provider.baseURL) || 'https://openrouter.ai/api/v1';
    const apiKey = (provider && provider.apiKey) || s.apiKey || '';

    if (!apiKey) throw new Error('No API key. Set it in Settings.');
    if (!provider) throw new Error(`No provider found for model "${model}"`);

    // Anthropic's native API (api.anthropic.com) is NOT OpenAI-compatible:
    // different endpoint path, auth header, request body, and SSE event
    // shape. Route it separately rather than sending an OpenAI-style
    // request that would just fail against their real API.
    if (provider.isAnthropicNative || /api\.anthropic\.com/.test(baseURL)) {
      return this._callAnthropic(baseURL, apiKey, model, messages, onChunk, signal);
    }

    // For Ollama: strip "ollama/" prefix, use just the model name
    const actualModel = provider.id === 'ollama' ? model.replace('ollama/', '') : model;

    const url = `${baseURL.replace(/\/+$/,'')}/chat/completions`;
    const headers = {
      'Content-Type':'application/json',
      'Authorization':`Bearer ${apiKey}`,
    };
    if (provider.id === 'openrouter') {
      headers['HTTP-Referer'] = location.origin;
      headers['X-Title'] = 'OrinIDE';
    }
    if (provider.headers) {
      for (const h of provider.headers) {
        if (h.key) headers[h.key] = h.value;
      }
    }

    const modelLimit = (typeof TokenEst !== 'undefined') ? TokenEst.getModelLimit(model) : 32000;
    const isFree = (typeof TokenEst !== 'undefined') ? TokenEst.isSmallContext(model) : false;
    const maxOutput = isFree ? 4096 : 8192;
    const body = { model: actualModel, messages, stream: true, temperature: 0.2, max_tokens: maxOutput };

    // Pre-flight token check — auto-truncate instead of dead-ending the user.
    // Previously this threw a hard error ("no context left, try again") and
    // left it up to the *next* message to somehow fit — but nothing actually
    // shrank the history in between, so retrying just threw the same error
    // forever. Now we proactively drop the oldest non-system turns here, so
    // the send that's in flight right now still has a chance to succeed.
    if (typeof TokenEst !== 'undefined') {
      const available = modelLimit - maxOutput;
      let inputTokens = messages.reduce((sum, m) => sum + TokenEst.estimate(m.content), 0);
      if (inputTokens > available) {
        messages = TokenEst.fitHistory(messages, Math.max(500, available));
        inputTokens = messages.reduce((sum, m) => sum + TokenEst.estimate(m.content), 0);
        body.messages = messages;
      }
      // Only fail if even the system + latest user message alone can't fit —
      // at that point there's genuinely nothing left to trim.
      if (inputTokens > available && available > 0) {
        throw new Error(`Even your latest message is too large for this model (~${inputTokens} tokens, limit ${modelLimit}). Try a model with a bigger context window in Settings, or shorten your message.`);
      }
    }

    // Try backend proxy first (avoids CORS on Termux/mobile), fall back to direct
    let res;
    try {
      const proxyRes = await fetch('/api/ai/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, headers, body }),
        signal
      });
      if (proxyRes.ok) {
        res = proxyRes;
      } else {
        throw new Error('Proxy failed');
      }
    } catch {
      // Fall back to direct fetch
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal
      });
    }

    if(!res.ok){
      let errMsg=`API error ${res.status}`;
      try{
        const e=await res.json();
        errMsg=e.error?.message||e.message||errMsg;
        if(res.status===401)errMsg=`Invalid API key for ${provider.name}. Check your key in Settings.`;
        else if(res.status===429)errMsg='Rate limit reached. Please wait a moment and try again.';
        else if(res.status===400)errMsg=`Model "${actualModel}" returned an error: ${errMsg}`;
      }catch(ex){}
      throw new Error(errMsg);
    }

    const reader=res.body.getReader();const dec=new TextDecoder();let full='';
    this._lastUsage = null;
    this._lastFinishReason = null;
    while(true){
      const{done,value}=await reader.read();if(done)break;
      for(const line of dec.decode(value,{stream:true}).split('\n')){
        if(!line.startsWith('data: '))continue;
        const d=line.slice(6).trim();if(d==='[DONE]')break;
        try{
          const parsed = JSON.parse(d);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) { full += delta; if (onChunk) onChunk(delta, full); }
          if (parsed.usage) { this._lastUsage = parsed.usage; }
          // finish_reason arrives on the final chunk for this choice —
          // 'length' means the model got cut off by max_tokens, 'stop'
          // means it finished on its own. This is ground truth, unlike
          // guessing from the shape of the text afterwards.
          const fr = parsed.choices?.[0]?.finish_reason;
          if (fr) { this._lastFinishReason = fr; }
        } catch {}
      }
    }
    return full;
  },

  // Anthropic native Messages API: POST /v1/messages, x-api-key auth,
  // a system prompt is a top-level field (not a role:"system" message),
  // and streaming events use Anthropic's own SSE event names rather than
  // OpenAI's `choices[0].delta.content` shape.
  async _callAnthropic(baseURL, apiKey, model, messages, onChunk, signal) {
    const url = `${baseURL.replace(/\/+$/,'')}/messages`;
    const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
    const conv = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));

    const isFree = (typeof TokenEst !== 'undefined') ? TokenEst.isSmallContext(model) : false;
    const maxOutput = isFree ? 4096 : 8192;
    const body = {
      model, messages: conv, stream: true, max_tokens: maxOutput,
      ...(system ? { system } : {})
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body),
      signal
    });

    if (!res.ok) {
      let errMsg = `API error ${res.status}`;
      try {
        const e = await res.json();
        errMsg = e.error?.message || errMsg;
        if (res.status === 401) errMsg = 'Invalid Anthropic API key. Check your key in Settings.';
        else if (res.status === 429) errMsg = 'Rate limit reached. Please wait a moment and try again.';
      } catch {}
      throw new Error(errMsg);
    }

    const reader = res.body.getReader(); const dec = new TextDecoder(); let full = '';
    this._lastUsage = null;
    this._lastFinishReason = null;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      for (const line of dec.decode(value, { stream: true }).split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const d = line.slice(6).trim();
        if (!d) continue;
        try {
          const parsed = JSON.parse(d);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            full += parsed.delta.text;
            if (onChunk) onChunk(parsed.delta.text, full);
          }
          if (parsed.type === 'message_delta') {
            if (parsed.usage) this._lastUsage = parsed.usage;
            // Anthropic sends stop_reason on the message_delta event:
            // 'end_turn' (finished naturally) or 'max_tokens' (cut off).
            if (parsed.delta?.stop_reason) this._lastFinishReason = parsed.delta.stop_reason;
          }
        } catch {}
      }
    }
    return full;
  }
};
window.API = API;
