'use strict';
const FileTree={
  project:null, ctxTarget:null, newMode:'file', newParent:'',
  init(){
    document.getElementById('btn-new-file')?.addEventListener('click',()=>this.promptNew('file',''));
    document.getElementById('btn-new-folder')?.addEventListener('click',()=>this.promptNew('folder',''));
    document.getElementById('btn-refresh-tree')?.addEventListener('click',()=>this.refresh());
    document.getElementById('btn-new-project')?.addEventListener('click',()=>openModal('project-modal'));
    document.getElementById('btn-zip-import-proj')?.addEventListener('click',()=>{ if(typeof ImportMgr!=='undefined'&&ImportMgr.openFilePicker) ImportMgr.openFilePicker(); });
    document.getElementById('btn-open-project-mgr')?.addEventListener('click',()=>openModal('project-modal'));
    document.getElementById('btn-create-project')?.addEventListener('click',()=>this.createProject());
    document.getElementById('inp-new-project')?.addEventListener('keydown',e=>{if(e.key==='Enter')this.createProject()});
    document.getElementById('btn-confirm-newfile')?.addEventListener('click',()=>this.confirmNew());
    document.getElementById('inp-newfile')?.addEventListener('keydown',e=>{if(e.key==='Enter')this.confirmNew()});
    document.getElementById('file-search')?.addEventListener('input',debounce(e=>{
      const q=e.target.value.trim().toLowerCase();
      document.querySelectorAll('.ti').forEach(el=>{
        el.classList.toggle('hidden-search',!!q&&!el.dataset.name.includes(q));
      });
    },200));
    document.addEventListener('contextmenu',e=>{
      const ti=e.target.closest('.ti');
      if(ti){e.preventDefault();this.showCtx(e.clientX,e.clientY,ti)}
    });
    document.addEventListener('click',e=>{if(!e.target.closest('#ctx-menu'))this.hideCtx()});
    document.getElementById('ctx-menu')?.addEventListener('click',e=>{
      const a=e.target.closest('[data-action]')?.dataset.action;
      if(a)this.handleCtx(a);
    });
    this.loadProjects();
  },
  async loadProjects(){
    try{const{projects}=await API.getProjects();this._renderProjects(projects||[]);this._renderModalProjects(projects||[])}catch{}
  },
  _renderProjects(list){
    const el=document.getElementById('project-list');
    if(!list.length){el.innerHTML='<div style="padding:6px 12px;color:var(--tx2);font-size:11px">No projects</div>';return}
    el.innerHTML=list.map(p=>`
      <div class="proj-item${p===this.project?' active':''}" data-p="${esc(p)}">
        <div class="proj-item-left">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          <span class="proj-name">${esc(p)}</span>
        </div>
        <div class="proj-actions">
          <button class="proj-btn proj-zip-export" data-p="${esc(p)}" title="Export ZIP">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          <button class="proj-btn proj-rename" data-p="${esc(p)}" title="Rename">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
          <button class="proj-btn proj-del" data-del="${esc(p)}" title="Delete">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>`).join('');
    el.querySelectorAll('.proj-item').forEach(d=>{
      d.addEventListener('click',e=>{if(e.target.closest('.proj-actions'))return;this.openProject(d.dataset.p)});
    });
    el.querySelectorAll('.proj-del').forEach(b=>{
      b.addEventListener('click',e=>{e.stopPropagation();this.deleteProject(b.dataset.del)});
    });
    el.querySelectorAll('.proj-zip-export').forEach(b=>{
      b.addEventListener('click',e=>{
        e.stopPropagation();
        const proj=b.dataset.p;
        const a=document.createElement('a');
        a.href=API.exportZipUrl(proj);a.download=proj+'.zip';
        document.body.appendChild(a);a.click();document.body.removeChild(a);
        toast('Downloading '+proj+'.zip','ok',1500);
      });
    });
    el.querySelectorAll('.proj-rename').forEach(b=>{
      b.addEventListener('click',e=>{
        e.stopPropagation();
        const oldName=b.dataset.p;
        const newName=prompt('Rename "'+oldName+'" to:',oldName);
        if(!newName||newName.trim()===oldName)return;
        const n=newName.trim().replace(/[^a-zA-Z0-9_\-. ]/g,'_');
        API.execCmd('mv "'+oldName+'" "'+n+'" 2>&1',null).then(r=>{
          if(r.exitCode===0){toast('Renamed to '+n,'ok');this.refresh();}
          else toast('Rename failed'+(r.stdout||r.stderr?': '+(r.stdout||r.stderr).trim().slice(0,60):''),'err',4000);
        });
      });
    });
  },
  _renderModalProjects(list){
    const el=document.getElementById('modal-project-list');
    if(!list.length){el.innerHTML='<div style="color:var(--tx2);font-size:12px">No projects yet.</div>';return}
    el.innerHTML=list.map(p=>`<div class="mpl-item" data-p="${esc(p)}">&gt; ${esc(p)}</div>`).join('');
    el.querySelectorAll('.mpl-item').forEach(d=>{
      d.addEventListener('click',()=>{this.openProject(d.dataset.p);closeModal('project-modal')});
    });
  },
  async createProject(){
    const inp=document.getElementById('inp-new-project');
    const name=inp.value.trim();if(!name)return toast('Enter a project name','wrn');
    const r=await API.createProject(name);
    if(r.error)return toast(r.error,'err');
    inp.value='';await this.loadProjects();this.openProject(r.name);closeModal('project-modal');
    toast(`Project "${r.name}" created`,'ok');
  },
  async deleteProject(name){
    if(!confirm(`Delete "${name}"? This cannot be undone.`))return;
    await API.deleteProject(name);
    if(this.project===name){this.project=null;document.getElementById('tb-project-name').textContent='—';document.getElementById('file-tree').innerHTML='<div class="empty-msg">Open or create a project to start</div>';EditorMgr.closeAll()}
    await this.loadProjects();toast('Project deleted','ok');
  },
  async openProject(name){
    this.project=name;
    document.getElementById('tb-project-name').textContent=name;
    document.title=name+' - OrinIDE';
    document.querySelectorAll('.proj-item').forEach(d=>d.classList.toggle('active',d.dataset.p===name));
    await this.refresh();toast('Opened: '+name,'ok',1200);
    // Keep git panel in sync with the currently open project
    if (window.GitMgr) GitMgr._project = name;
  },
  async refresh(){
    if(!this.project)return;
    try{const{tree}=await API.getTree(this.project);this._renderTree(tree||[])}catch(e){console.error(e)}
  },
  _renderTree(items,container=null){
    const el=container||document.getElementById('file-tree');
    if(!container){
      el.innerHTML='';
      if(typeof FileFavorites!=='undefined')FileFavorites.renderInTree(this.project,el);
      if(!items.length){el.innerHTML='<div class="empty-msg">Empty project. Create a file to start.</div>';return}
    }
    const sorted=[...items].sort((a,b)=>{
      if(a.type!==b.type)return a.type==='dir'?-1:1;
      return a.name.localeCompare(b.name);
    });
    sorted.forEach(item=>{
      const depth=item.path.split('/').length-1;
      const indent=depth*14;
      const d=document.createElement('div');
      d.className='ti'; d.dataset.path=item.path; d.dataset.type=item.type;
      d.dataset.name=item.name.toLowerCase();
      if(item.type==='dir'){
        d.innerHTML=`<span class="ti-indent" style="width:${indent}px"></span>
          <span class="ti-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg></span>
          <span class="ti-icon">&gt;</span>
          <span class="ti-name">${esc(item.name)}</span>
          <div class="ti-actions"><button class="ti-act" data-a="nf" title="New File">+</button></div>`;
        d.addEventListener('click',e=>{if(e.target.closest('.ti-actions'))return;this._toggleDir(d,item)});
        d.querySelector('[data-a="nf"]')?.addEventListener('click',e=>{e.stopPropagation();this.promptNew('file',item.path)});
        el.appendChild(d);
        const ch=document.createElement('div');ch.className='ti-children';ch.dataset.dir=item.path;
        el.appendChild(ch);
        if(item.children?.length)this._renderTree(item.children,ch);
      } else {
        d.innerHTML=`<span class="ti-indent" style="width:${indent+14}px"></span>
          <span class="ti-icon">${fileIcon(item.name)}</span>
          <span class="ti-name">${esc(item.name)}</span>
          <div class="ti-actions">
            <button class="ti-act" data-a="ren" title="Rename (double-click also works)"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
            <button class="ti-act" data-a="del" title="Delete"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>`;
        d.addEventListener('click',e=>{if(e.target.closest('.ti-actions'))return;this.openFile(item.path);this._setActive(d)});
        d.addEventListener('dblclick',()=>this.startRename(d,item));
        d.querySelector('[data-a="ren"]')?.addEventListener('click',e=>{e.stopPropagation();this.startRename(d,item)});
        d.querySelector('[data-a="del"]')?.addEventListener('click',e=>{e.stopPropagation();this.deleteItem(item)});
        el.appendChild(d);
      }
    });
  },
  _toggleDir(d,item){
    const arrow=d.querySelector('.ti-arrow');
    const ch=d.nextElementSibling;
    if(!ch?.classList.contains('ti-children'))return;
    const open=ch.classList.contains('open');
    ch.classList.toggle('open',!open);arrow.classList.toggle('open',!open);
  },
  _setActive(d){document.querySelectorAll('.ti').forEach(e=>e.classList.remove('active'));d.classList.add('active')},
  async openFile(path){
    if(!this.project)return toast('No project open','wrn');
    // Binary/media files: show image preview or serve as download rather than crashing editor
    const isBinary=/\.(png|jpg|jpeg|gif|webp|svg|ico|bmp|tiff|mp4|webm|mov|mp3|wav|ogg|flac|pdf|woff|woff2|ttf|eot|zip|gz|tar|bin|exe|dmg)$/i.test(path);
    if(isBinary){
      const isImage=/\.(png|jpg|jpeg|gif|webp|svg|ico|bmp|tiff)$/i.test(path);
      if(isImage){
        // Open image in a tab as a preview
        const url=API.assetUrl(this.project,path);
        EditorMgr.openTab(path,'/* Binary image — previewing below */\n/* Path: '+path+' */\n/* URL:  '+url+' */');
        toast('Image: right-click in file tree to rename. Preview in Live Preview.','inf',4000);
      } else {
        toast('Binary file: '+path.split('/').pop()+' — use right-click or hover icon to rename.','inf',3000);
      }
      return;
    }
    const data=await API.readFile(this.project,path);
    if(data.error)return toast(data.error,'err');
    EditorMgr.openTab(path,data.content);
  },
  async deleteItem(item){
    if(!confirm(`Delete "${item.path}"?`))return;
    await API.deleteFile(this.project,item.path);
    await this.refresh();EditorMgr.closeTab(item.path);
    toast('Deleted','ok',1000);
  },
  promptNew(mode,parent){
    this.newMode=mode;this.newParent=parent;
    const isDir=mode==='folder';
    document.getElementById('newfile-title').textContent=isDir?'New Folder':'New File';
    document.getElementById('newfile-lbl').textContent=isDir?'Folder path':'File path (e.g. src/index.js)';
    document.getElementById('inp-newfile').value=parent?parent+'/':'';
    openModal('newfile-modal');setTimeout(()=>document.getElementById('inp-newfile').focus(),80);
  },
  async confirmNew(){
    const path=document.getElementById('inp-newfile').value.trim();
    if(!path)return toast('Enter a path','wrn');
    if(!this.project)return toast('No project open','wrn');
    if(this.newMode==='folder'){await API.createFolder(this.project,path)}
    else{await API.writeFile(this.project,path,'');await this.refresh();await this.openFile(path)}
    document.getElementById('inp-newfile').value='';
    closeModal('newfile-modal');await this.refresh();toast('Created','ok',1000);
  },
  startRename(d,item){
    const nameEl=d.querySelector('.ti-name');
    const inp=document.createElement('input');inp.className='ti-rename';inp.value=item.name;
    nameEl.replaceWith(inp);inp.focus();inp.select();
    const commit=async()=>{
      const n=inp.value.trim();
      if(n&&n!==item.name){
        const np=item.path.replace(/[^/]*$/,n);
        try{await API.renameFile(this.project,item.path,np);await this.refresh()}
        catch(e){toast('Rename failed: '+e.message,'err');inp.replaceWith(nameEl)}
      } else inp.replaceWith(nameEl);
    };
    inp.addEventListener('blur',commit);
    inp.addEventListener('keydown',e=>{if(e.key==='Enter')inp.blur();if(e.key==='Escape')inp.replaceWith(nameEl)});
  },
  showCtx(x,y,ti){
    this.ctxTarget=ti;const m=document.getElementById('ctx-menu');m.classList.remove('hidden');
    const vw=window.innerWidth,vh=window.innerHeight;
    m.style.left=Math.min(x,vw-170)+'px';m.style.top=Math.min(y,vh-210)+'px';
  },
  hideCtx(){document.getElementById('ctx-menu').classList.add('hidden');this.ctxTarget=null},
  async handleCtx(action){
    const el=this.ctxTarget;if(!el)return;
    const path=el.dataset.path,type=el.dataset.type;
    const item={path,name:path.split('/').pop(),type};
    if(action==='open'&&type==='file')this.openFile(path);
    else if(action==='rename')this.startRename(el,item);
    else if(action==='delete')this.deleteItem(item);
    else if(action==='duplicate'&&type==='file'){
      try{
        const data=await API.readFile(this.project,path);
        const ext=path.includes('.')?'.'+path.split('.').pop():'';
        const base=path.replace(/\.[^/.]+$/,'');
        const np=base+'_copy'+ext;
        await API.writeFile(this.project,np,data.content);
        await this.refresh();toast('Duplicated as '+np.split('/').pop(),'ok');
      }catch(e){toast('Duplicate failed: '+e.message,'err')}
    }
    else if(action==='new-file-here')this.promptNew('file',type==='dir'?path:path.split('/').slice(0,-1).join('/'));
    else if(action==='new-folder-here')this.promptNew('folder',type==='dir'?path:path.split('/').slice(0,-1).join('/'));
    else if(action==='toggle-fav'){
      if(typeof FileFavorites!=='undefined'){
        FileFavorites.toggle(this.project,path);
        this.refresh();
      }
    }
    this.hideCtx();
  }
};
window.FileTree = FileTree;
