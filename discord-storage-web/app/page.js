"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Upload, FolderOpen, BarChart2, Grid, Folder, Download, Trash2, X,
  CheckCircle, AlertCircle, FileText, FileImage, FileVideo, FileAudio,
  FileCode, FileArchive, File as FileLucide, ChevronRight, Layers,
  Search, Lock, Eye, EyeOff, LogOut, Shield
} from "lucide-react";

// ─── Discord Logo ─────────────────────────────────────────────────────────────
function DiscordLogo({ size = 20 }) {
  return (
    <svg width={size} height={Math.round(size * 0.76)} viewBox="0 0 127.14 96.36" fill="currentColor">
      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
    </svg>
  );
}

// ─── Crypto Utils ─────────────────────────────────────────────────────────────
const PBKDF2_SALT = new TextEncoder().encode("DiscordUnlimited-v1");

async function deriveKey(password) {
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: PBKDF2_SALT, iterations: 100000, hash: "SHA-256" }, km, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function encryptBuffer(buffer, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, buffer);
  const out = new Uint8Array(12 + enc.byteLength);
  out.set(iv); out.set(new Uint8Array(enc), 12);
  return out;
}

async function decryptBuffer(buffer, key) {
  const data = new Uint8Array(buffer);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: data.slice(0, 12) }, key, data.slice(12));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getItemsAtPath(allFiles, path) {
  const prefix = path ? `${path}/` : "";
  const folderSet = new Set(); const directFiles = [];
  for (const f of allFiles) {
    if (prefix && !f.filename.startsWith(prefix)) continue;
    const rest = prefix ? f.filename.slice(prefix.length) : f.filename;
    const i = rest.indexOf("/");
    if (i === -1) directFiles.push(f); else folderSet.add(rest.slice(0, i));
  }
  return { folders: [...folderSet].sort(), files: directFiles };
}

function formatBytes(b, d = 1) {
  if (!+b) return "0 B";
  const k = 1024, s = ["B","KB","MB","GB","TB"], i = Math.floor(Math.log(b)/Math.log(k));
  return `${parseFloat((b/Math.pow(k,i)).toFixed(d))} ${s[i]}`;
}
function formatDate(d) { return new Date(d).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }); }
function getFileColor(f) {
  const e = f?.split(".").pop()?.toLowerCase() || "";
  if (["jpg","jpeg","png","gif","webp","svg"].includes(e)) return "#c084fc";
  if (["mp4","mov","avi","mkv","webm"].includes(e))        return "#f472b6";
  if (["mp3","wav","ogg","flac"].includes(e))              return "#fb923c";
  if (["js","ts","jsx","tsx","py","go","rs","java","html","css","json"].includes(e)) return "#34d399";
  if (["zip","tar","gz","rar","7z"].includes(e))           return "#fbbf24";
  return "#818cf8";
}
function getFileTypeLabel(f) {
  const e = f?.split(".").pop()?.toLowerCase() || "";
  if (["jpg","jpeg","png","gif","webp","svg"].includes(e)) return "Image";
  if (["mp4","mov","avi","mkv","webm"].includes(e))        return "Video";
  if (["mp3","wav","ogg","flac"].includes(e))              return "Audio";
  if (["js","ts","jsx","tsx","py","go","rs","java","html","css","json"].includes(e)) return "Code";
  if (["zip","tar","gz","rar","7z"].includes(e))           return "Archive";
  if (["pdf","doc","docx","xls","xlsx","ppt","pptx"].includes(e)) return "Document";
  return "Other";
}
function getFileIcon(f, size = 22) {
  const e = f?.split(".").pop()?.toLowerCase() || "", p = { size, strokeWidth: 1.5 };
  if (["jpg","jpeg","png","gif","webp","svg"].includes(e)) return <FileImage {...p}/>;
  if (["mp4","mov","avi","mkv","webm"].includes(e))        return <FileVideo {...p}/>;
  if (["mp3","wav","ogg","flac"].includes(e))              return <FileAudio {...p}/>;
  if (["js","ts","jsx","tsx","py","go","rs","java","html","css","json"].includes(e)) return <FileCode {...p}/>;
  if (["zip","tar","gz","rar","7z"].includes(e))           return <FileArchive {...p}/>;
  if (["pdf","doc","docx","xls","xlsx","txt","md"].includes(e)) return <FileText {...p}/>;
  return <FileLucide {...p}/>;
}
const TYPE_COLORS = { Image:"#c084fc", Video:"#f472b6", Audio:"#fb923c", Code:"#34d399", Archive:"#fbbf24", Document:"#818cf8", Other:"#6b7280" };

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [token,     setToken]     = useState("");
  const [channelId, setChannelId] = useState("");
  const [password,  setPassword]  = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  const submit = async e => {
    e.preventDefault();
    if (!token.trim() || !channelId.trim()) { setError("Bot token and channel ID are required."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/files", { headers: { "X-Discord-Token": token.trim(), "X-Discord-Channel-Id": channelId.trim() } });
      if (!res.ok) throw new Error("Connection failed");
      sessionStorage.setItem("du_token",      token.trim());
      sessionStorage.setItem("du_channel_id", channelId.trim());
      sessionStorage.setItem("du_password",   password.trim());
      onLogin({ token: token.trim(), channelId: channelId.trim(), password: password.trim() });
    } catch { setError("Could not connect. Check your bot token and channel ID."); }
    setLoading(false);
  };

  return (
    <div className="login-screen">
      <div className="login-card animate-fade-in">
        <div className="login-header">
          <div className="login-logo-wrap"><DiscordLogo size={30}/></div>
          <h1>DiscordUnlimited</h1>
          <p>Connect your Discord bot to get started</p>
        </div>
        <form onSubmit={submit}>
          <div className="login-field">
            <label>Bot Token</label>
            <div className="input-wrap">
              <input type={showToken ? "text" : "password"} value={token} onChange={e => setToken(e.target.value)} placeholder="Paste your bot token…" autoComplete="off"/>
              <button type="button" onClick={() => setShowToken(v => !v)}>{showToken ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
            </div>
          </div>
          <div className="login-field">
            <label>Channel ID</label>
            <div className="input-wrap">
              <input type="text" value={channelId} onChange={e => setChannelId(e.target.value)} placeholder="Right-click a channel → Copy ID"/>
            </div>
          </div>
          <div className="login-field">
            <label>Encryption Password <span className="optional-badge">optional</span></label>
            <div className="input-wrap">
              <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="AES-256 encryption key…"/>
              <button type="button" onClick={() => setShowPw(v => !v)}>{showPw ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
            </div>
            <span className="login-hint"><Shield size={11}/> Files are encrypted in your browser before upload. Leave blank for no encryption.</span>
          </div>
          {error && <div className="login-error"><AlertCircle size={13}/> {error}</div>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Connecting…" : <><DiscordLogo size={14}/> Connect</>}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toasts, dismiss }) {
  return (
    <div style={{ position:"fixed", bottom:"5.5rem", right:"1.25rem", display:"flex", flexDirection:"column", gap:"0.5rem", zIndex:100 }}>
      {toasts.map(t => (
        <div key={t.id} className="toast animate-slide-up" style={{ borderColor: t.type==="error"?"var(--danger)":t.type==="success"?"var(--success)":"var(--glass-border)" }}>
          <span style={{ color: t.type==="error"?"var(--danger)":t.type==="success"?"var(--success)":"var(--text-muted)" }}>
            {t.type==="error"?<AlertCircle size={13}/>:<CheckCircle size={13}/>}
          </span>
          <span style={{ flex:1, fontSize:"0.78rem" }}>{t.message}</span>
          <button onClick={() => dismiss(t.id)} style={{ background:"none", border:"none", color:"var(--text-muted)", cursor:"pointer", padding:0 }}><X size={11}/></button>
        </div>
      ))}
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({ title, body, onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal animate-fade-in" onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"1rem" }}>
          <div style={{ background:"rgba(239,68,68,0.15)", padding:"0.5rem", borderRadius:"8px" }}><Trash2 size={18} color="var(--danger)"/></div>
          <h3 style={{ fontWeight:600 }}>{title}</h3>
        </div>
        <p style={{ color:"var(--text-muted)", marginBottom:"1.5rem", lineHeight:1.6, fontSize:"0.875rem" }}>{body}</p>
        <div style={{ display:"flex", gap:"0.75rem", justifyContent:"flex-end" }}>
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── File Inspector ───────────────────────────────────────────────────────────
function FileInspector({ file, onClose, onDownload, onDelete }) {
  const color = getFileColor(file.filename), base = file.filename.split("/").pop();
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="inspector animate-fade-in" onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
          <span style={{ fontWeight:600, fontSize:"0.875rem" }}>Get Info</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"var(--text-muted)", cursor:"pointer" }}><X size={16}/></button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"1.25rem 0", gap:"0.75rem", borderBottom:"1px solid var(--glass-border)", marginBottom:"1rem" }}>
          <div style={{ width:72, height:72, borderRadius:"18px", background:`${color}18`, display:"flex", alignItems:"center", justifyContent:"center", color }}>{getFileIcon(file.filename, 34)}</div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontWeight:600, fontSize:"0.9rem" }}>{base}</div>
            <div style={{ fontSize:"0.72rem", color:"var(--text-muted)", marginTop:"0.2rem", display:"flex", alignItems:"center", gap:"0.4rem", justifyContent:"center" }}>
              {getFileTypeLabel(file.filename)}
              {file.encrypted && <span style={{ color:"#34d399", display:"flex", alignItems:"center", gap:"0.2rem" }}><Lock size={10}/> Encrypted</span>}
            </div>
          </div>
        </div>
        {[{ label:"Size", value:formatBytes(file.size) }, { label:"Uploaded", value:formatDate(file.uploadDate) }, { label:"Chunks", value:`${file.chunkCount} part${file.chunkCount!==1?"s":""}` }, { label:"Path", value:file.filename }].map(({ label, value }) => (
          <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:"0.5rem 0", borderBottom:"1px solid rgba(255,255,255,0.04)", gap:"1rem" }}>
            <span style={{ fontSize:"0.78rem", color:"var(--text-muted)", flexShrink:0 }}>{label}</span>
            <span style={{ fontSize:"0.78rem", fontWeight:500, textAlign:"right", wordBreak:"break-all" }}>{value}</span>
          </div>
        ))}
        <div style={{ marginTop:"1.25rem", display:"flex", flexDirection:"column", gap:"0.5rem" }}>
          <button className="btn-primary" style={{ width:"100%", justifyContent:"center" }} onClick={() => onDownload(file.id, file.filename)}><Download size={14}/> Download</button>
          <button className="btn-danger-outline" style={{ width:"100%", justifyContent:"center" }} onClick={() => { onClose(); onDelete(file); }}><Trash2 size={14}/> Move to Trash</button>
        </div>
      </div>
    </div>
  );
}

// ─── Folder Window ────────────────────────────────────────────────────────────
function FolderFileRow({ file, onDownload, onDelete }) {
  const color = getFileColor(file.filename);
  return (
    <div className="fw-file-row">
      <div style={{ color, flexShrink:0 }}>{getFileIcon(file.filename, 13)}</div>
      <span className="fw-file-name">{file.filename.split("/").pop()}</span>
      {file.encrypted && <Lock size={9} color="#34d399" style={{ flexShrink:0 }}/>}
      <span className="fw-file-size">{formatBytes(file.size)}</span>
      <div className="fw-file-actions">
        <button onClick={e => { e.stopPropagation(); onDownload(file.id, file.filename); }}><Download size={10}/></button>
        <button onClick={e => { e.stopPropagation(); onDelete(file); }}><Trash2 size={10}/></button>
      </div>
    </div>
  );
}

function FolderDropdown({ name, fullPath, allFiles, onDownload, onDelete, depth = 0 }) {
  const [open, setOpen] = useState(false);
  const { folders, files } = useMemo(() => getItemsAtPath(allFiles, fullPath), [allFiles, fullPath]);
  return (
    <div className="fw-folder">
      <div className="fw-folder-header" onClick={() => setOpen(v => !v)} style={{ paddingLeft: `${(depth * 12) + 6}px` }}>
        <ChevronRight size={11} style={{ transform:open?"rotate(90deg)":"none", transition:"0.15s", flexShrink:0 }}/>
        <Folder size={13} color="#fbbf24" style={{ flexShrink:0 }}/>
        <span>{name}/</span>
        <span className="fw-folder-count">{folders.length + files.length}</span>
      </div>
      {open && (
        <div>
          {folders.map(sf => <FolderDropdown key={sf} name={sf} fullPath={`${fullPath}/${sf}`} allFiles={allFiles} onDownload={onDownload} onDelete={onDelete} depth={depth + 1}/>)}
          {files.map(f => <FolderFileRow key={f.id} file={f} onDownload={onDownload} onDelete={onDelete}/>)}
          {folders.length === 0 && files.length === 0 && <div style={{ padding:"0.5rem 1rem", fontSize:"0.72rem", color:"var(--text-muted)" }}>Empty</div>}
        </div>
      )}
    </div>
  );
}

function FolderWindow({ folder, allFiles, onClose, onDownload, onDelete, onDeleteFolder }) {
  const { folders, files } = useMemo(() => getItemsAtPath(allFiles, folder.path), [allFiles, folder]);
  return (
    <div className="modal-backdrop" onClick={onClose} style={{ alignItems:"flex-start", paddingTop:"calc(var(--menu-h) + 3rem)" }}>
      <div className="folder-window animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="fw-titlebar">
          <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
            <Folder size={14} color="#fbbf24"/>
            <span style={{ fontWeight:600, fontSize:"0.82rem" }}>{folder.name}/</span>
          </div>
          <div style={{ display:"flex", gap:"0.375rem" }}>
            <button className="fw-btn-danger" title="Delete folder" onClick={() => { onClose(); onDeleteFolder(folder.name); }}><Trash2 size={11}/></button>
            <button className="fw-btn-close" onClick={onClose}><X size={12}/></button>
          </div>
        </div>
        <div className="fw-content">
          {folders.length === 0 && files.length === 0
            ? <div style={{ padding:"2rem", textAlign:"center", color:"var(--text-muted)", fontSize:"0.82rem" }}>This folder is empty</div>
            : <>
                {folders.map(sf => <FolderDropdown key={sf} name={sf} fullPath={`${folder.path}/${sf}`} allFiles={allFiles} onDownload={onDownload} onDelete={onDelete}/>)}
                {files.map(f => <FolderFileRow key={f.id} file={f} onDownload={onDownload} onDelete={onDelete}/>)}
              </>
          }
        </div>
        <div className="fw-footer">
          <span>{folders.length} folder{folders.length!==1?"s":""}</span>
          <span>{files.length} file{files.length!==1?"s":""}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Desktop Icons ────────────────────────────────────────────────────────────
function DesktopFolderIcon({ name, onClick, onDelete, onDownload }) {
  return (
    <div className="desktop-icon icon-with-actions" onClick={onClick} title={name}>
      <div className="desktop-icon-visual" style={{ position:"relative" }}>
        <Folder size={52} strokeWidth={1.2} color="#fbbf24" style={{ filter:"drop-shadow(0 4px 12px rgba(251,191,36,0.4))" }}/>
        <div className="icon-action-bar">
          <button title="Download as ZIP" onClick={e => { e.stopPropagation(); onDownload(name); }}><Download size={10}/></button>
          <button title="Delete folder"   onClick={e => { e.stopPropagation(); onDelete(name);   }}><Trash2   size={10}/></button>
        </div>
      </div>
      <span className="desktop-icon-name">{name}</span>
    </div>
  );
}

function DesktopFileIcon({ file, displayName, showPath, onInspect, onDownload, onDelete }) {
  const color = getFileColor(file.filename);
  const pathDir = file.filename.includes("/") ? file.filename.split("/").slice(0,-1).join("/") : null;
  return (
    <div className="desktop-icon file-icon icon-with-actions" onClick={onInspect} title={file.filename}>
      <div className="desktop-icon-visual" style={{ background:`${color}18`, color, position:"relative" }}>
        {getFileIcon(file.filename, 30)}
        {file.encrypted && <Lock size={9} color="#34d399" style={{ position:"absolute", top:4, right:4 }}/>}
        <div className="icon-action-bar">
          <button onClick={e => { e.stopPropagation(); onDownload(file.id, file.filename); }}><Download size={10}/></button>
          <button onClick={e => { e.stopPropagation(); onDelete(file); }}><Trash2 size={10}/></button>
        </div>
      </div>
      <span className="desktop-icon-name">{displayName}</span>
      {showPath && pathDir && <span className="desktop-icon-path">{pathDir}/</span>}
      <span className="desktop-icon-size">{formatBytes(file.size)}</span>
    </div>
  );
}

// ─── Stats View ───────────────────────────────────────────────────────────────
function StatsView({ files }) {
  const totalSize = files.reduce((a, f) => a + f.size, 0);
  const folders = new Set(files.filter(f => f.filename.includes("/")).map(f => f.filename.split("/")[0]));
  const byType  = files.reduce((a, f) => { const t = getFileTypeLabel(f.filename); a[t] = (a[t]||0)+1; return a; }, {});
  const recent  = [...files].sort((a,b) => new Date(b.uploadDate)-new Date(a.uploadDate)).slice(0, 6);
  const encrypted = files.filter(f => f.encrypted).length;
  return (
    <div className="desktop-surface" style={{ paddingTop:"1.5rem" }}>
      <h2 style={{ fontSize:"1.4rem", fontWeight:700, marginBottom:"1.75rem", letterSpacing:"-0.025em" }}>Storage Overview</h2>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:"1rem", marginBottom:"1.75rem" }}>
        {[
          { icon:<Grid size={17} color="var(--accent)"/>,       label:"Files",     value:files.length },
          { icon:<Folder size={17} color="#fbbf24"/>,            label:"Folders",   value:folders.size },
          { icon:<Layers size={17} color="#34d399"/>,            label:"Stored",    value:formatBytes(totalSize) },
          { icon:<Shield size={17} color="#c084fc"/>,            label:"Encrypted", value:encrypted },
        ].map(({ icon, label, value }) => (
          <div key={label} className="stat-card">
            <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.75rem" }}>{icon}<span style={{ fontSize:"0.72rem", color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</span></div>
            <div style={{ fontSize:"1.5rem", fontWeight:700, letterSpacing:"-0.03em" }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.25rem" }}>
        <div className="stat-card">
          <h3 style={{ fontSize:"0.85rem", fontWeight:600, marginBottom:"1.25rem" }}>By File Type</h3>
          {!files.length ? <p style={{ color:"var(--text-muted)", fontSize:"0.875rem" }}>No files yet</p>
            : <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem" }}>
                {Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([type, count]) => (
                  <div key={type} style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:TYPE_COLORS[type]||"#6b7280", flexShrink:0 }}/>
                    <span style={{ fontSize:"0.82rem", flex:1 }}>{type}</span>
                    <div style={{ flex:2, height:4, background:"rgba(255,255,255,0.06)", borderRadius:"99px", overflow:"hidden" }}>
                      <div style={{ width:`${(count/files.length)*100}%`, height:"100%", background:TYPE_COLORS[type]||"#6b7280", borderRadius:"99px" }}/>
                    </div>
                    <span style={{ fontSize:"0.75rem", color:"var(--text-muted)", minWidth:"1.5rem", textAlign:"right" }}>{count}</span>
                  </div>
                ))}
              </div>
          }
        </div>
        <div className="stat-card">
          <h3 style={{ fontSize:"0.85rem", fontWeight:600, marginBottom:"1.25rem" }}>Recent Uploads</h3>
          {!recent.length ? <p style={{ color:"var(--text-muted)", fontSize:"0.875rem" }}>No uploads yet</p>
            : <div style={{ display:"flex", flexDirection:"column", gap:"0.875rem" }}>
                {recent.map(f => (
                  <div key={f.id} style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
                    <div style={{ width:30, height:30, borderRadius:"8px", background:`${getFileColor(f.filename)}18`, display:"flex", alignItems:"center", justifyContent:"center", color:getFileColor(f.filename), flexShrink:0 }}>{getFileIcon(f.filename, 14)}</div>
                    <div style={{ flex:1, overflow:"hidden" }}>
                      <div style={{ fontSize:"0.78rem", fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{f.filename.split("/").pop()}</div>
                      <div style={{ fontSize:"0.7rem", color:"var(--text-muted)" }}>{formatDate(f.uploadDate)}</div>
                    </div>
                    <span style={{ fontSize:"0.72rem", color:"var(--text-muted)" }}>{formatBytes(f.size)}</span>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  );
}

// ─── Menu Bar ─────────────────────────────────────────────────────────────────
function MenuBar({ search, onSearch, onLogout, hasEncryption }) {
  return (
    <div className="menu-bar">
      <div className="menu-logo">
        <div className="menu-logo-icon"><DiscordLogo size={17}/></div>
        <span className="menu-logo-name">DiscordUnlimited</span>
        {hasEncryption && <span className="menu-enc-pill"><Lock size={9}/>E2E</span>}
      </div>
      <div className="menu-search">
        <Search size={13} color="var(--text-muted)" style={{ flexShrink:0 }}/>
        <input placeholder="Search files and folders…" value={search} onChange={e => onSearch(e.target.value)}/>
        {!search && <span className="menu-search-kbd">⌘K</span>}
      </div>
      <div className="menu-right">
        <button className="menu-icon-btn" onClick={onLogout} title="Disconnect"><LogOut size={15}/></button>
      </div>
    </div>
  );
}

// ─── Dock ─────────────────────────────────────────────────────────────────────
function Dock({ view, onView, onUploadFiles, onUploadFolder }) {
  const [showMenu, setShowMenu] = useState(false);
  return (
    <>
      {showMenu && (
        <>
          <div style={{ position:"fixed", inset:0, zIndex:39 }} onClick={() => setShowMenu(false)}/>
          <div className="upload-popover animate-fade-in">
            <button className="upload-menu-btn" onClick={() => { setShowMenu(false); onUploadFiles(); }}><Upload size={15}/> Upload Files</button>
            <button className="upload-menu-btn" onClick={() => { setShowMenu(false); onUploadFolder(); }}><FolderOpen size={15}/> Upload Folder</button>
          </div>
        </>
      )}
      <div className="dock">
        <div className={`dock-item${view==="desktop"?" active":""}`} onClick={() => { setShowMenu(false); onView("desktop"); }}><Grid size={20}/><span>Files</span></div>
        <div className="dock-item dock-upload" onClick={() => setShowMenu(v => !v)}><Upload size={20}/><span>Upload</span></div>
        <div className={`dock-item${view==="stats"?" active":""}`} onClick={() => { setShowMenu(false); onView("stats"); }}><BarChart2 size={20}/><span>Stats</span></div>
      </div>
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [credentials, setCredentials] = useState(null);
  const [hydrated,     setHydrated]    = useState(false);
  const [files,         setFiles]         = useState([]);
  const [uploads,       setUploads]       = useState({});
  const [isDragging,    setIsDragging]    = useState(false);
  const [search,        setSearch]        = useState("");
  const [view,          setView]          = useState("desktop");
  const [folderWindow,  setFolderWindow]  = useState(null);
  const [inspectedFile, setInspectedFile] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [toasts,        setToasts]        = useState([]);
  const fileInputRef   = useRef(null);
  const folderInputRef = useRef(null);
  const dragCounterRef = useRef(0);

  const apiHeaders = useMemo(() => ({
    "X-Discord-Token":      credentials?.token      || "",
    "X-Discord-Channel-Id": credentials?.channelId  || "",
  }), [credentials]);

  const addToast = useCallback((message, type = "info") => {
    const id = crypto.randomUUID();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);
  const dismissToast = useCallback(id => setToasts(p => p.filter(t => t.id !== id)), []);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/files", { headers: apiHeaders });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFiles(Array.isArray(data) ? data : []);
    } catch { setFiles([]); }
  }, [apiHeaders]);

  useEffect(() => { if (credentials) fetchFiles(); }, [credentials, fetchFiles]);

  // Load credentials from sessionStorage after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    const t = sessionStorage.getItem("du_token");
    const c = sessionStorage.getItem("du_channel_id");
    if (t && c) setCredentials({ token: t, channelId: c, password: sessionStorage.getItem("du_password") || "" });
    setHydrated(true);
  }, []);

  // Drag-and-drop
  useEffect(() => {
    const isFile = e => e.dataTransfer?.types?.includes("Files");
    const enter = e => { if (!isFile(e)) return; dragCounterRef.current++; setIsDragging(true); };
    const leave = e => { if (!isFile(e)) return; dragCounterRef.current--; if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setIsDragging(false); } };
    const over  = e => { e.preventDefault(); if (isFile(e)) e.dataTransfer.dropEffect = "copy"; };
    const drop  = e => { e.preventDefault(); dragCounterRef.current = 0; setIsDragging(false); if (e.dataTransfer.files.length) handleFilesSelected(e.dataTransfer.files, false); };
    window.addEventListener("dragenter", enter); window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);   window.addEventListener("drop", drop);
    return () => { window.removeEventListener("dragenter", enter); window.removeEventListener("dragleave", leave); window.removeEventListener("dragover", over); window.removeEventListener("drop", drop); };
  }, [folderWindow]); // eslint-disable-line

  // Files that should never be uploaded
  const SKIP_FILES = new Set([".DS_Store", "Thumbs.db", "desktop.ini", ".gitkeep", ".gitignore"]);
  function isJunkFile(name) {
    const base = name.split("/").pop();
    return base.startsWith("._") || base.startsWith(".") || SKIP_FILES.has(base) || name.includes("__MACOSX/");
  }

  async function handleFilesSelected(selectedFiles, fromFolder) {
    const basePath = folderWindow?.path || "";
    const tasks = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      if (isJunkFile(file.name)) continue;
      const displayName = fromFolder && file.webkitRelativePath
        ? (basePath ? `${basePath}/${file.webkitRelativePath}` : file.webkitRelativePath)
        : (basePath ? `${basePath}/${file.name}` : file.name);
      tasks.push({ file, displayName });
    }

    // Max 2 concurrent uploads — prevents Discord 429 rate-limit errors
    const MAX_CONCURRENT = 2;
    let cursor = 0;
    async function worker() {
      while (cursor < tasks.length) {
        const { file, displayName } = tasks[cursor++];
        await uploadFile(file, displayName);
      }
    }
    await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, tasks.length) }, worker));
  }

  async function uploadFile(file, displayName) {
    const CHUNK = 8 * 1024 * 1024;
    const id = crypto.randomUUID();
    let blob = file, size = file.size, encrypted = false;

    if (credentials?.password) {
      setUploads(p => ({ ...p, [id]: { name: displayName, progress: 0, status: "encrypting" } }));
      try {
        const key = await deriveKey(credentials.password);
        const enc = await encryptBuffer(await file.arrayBuffer(), key);
        blob = new Blob([enc]); size = enc.byteLength; encrypted = true;
      } catch { addToast(`Encryption failed for ${displayName.split("/").pop()}`, "error"); return; }
    }

    const total = Math.ceil(size / CHUNK);
    setUploads(p => ({ ...p, [id]: { name: displayName, progress: 0, status: "uploading" } }));
    let fileId = null, threadId = null, done = 0;

    for (let i = 0; i < total; i++) {
      const chunk = blob.slice(i * CHUNK, Math.min((i + 1) * CHUNK, size));
      const fd = new FormData();
      fd.append("file", chunk); fd.append("filename", displayName);
      fd.append("size", size.toString()); fd.append("chunkIndex", i.toString());
      fd.append("totalChunks", total.toString()); fd.append("encrypted", encrypted.toString());
      if (fileId)   fd.append("fileId",   fileId);
      if (threadId) fd.append("threadId", threadId);
      try {
        const res = await fetch("/api/upload", { method: "POST", headers: apiHeaders, body: fd });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (i === 0) { fileId = data.fileId; threadId = data.threadId; }
        done++;
        setUploads(p => ({ ...p, [id]: { ...p[id], progress: Math.min(100, Math.round((done/total)*100)) } }));
      } catch {
        setUploads(p => ({ ...p, [id]: { ...p[id], status: "error" } }));
        addToast(`Upload failed for ${displayName.split("/").pop()}`, "error"); return;
      }
    }
    setUploads(p => ({ ...p, [id]: { ...p[id], status: "done", progress: 100 } }));
    addToast(`${displayName.split("/").pop()} uploaded`, "success");
    fetchFiles();
    setTimeout(() => setUploads(p => { const n = {...p}; delete n[id]; return n; }), 3000);
  }

  const handleDownload = useCallback(async (fileId, filename) => {
    const base = filename.split("/").pop();
    const fileRecord = files.find(f => f.id === fileId);
    addToast(`Downloading ${base}…`, "info");
    try {
      const res = await fetch(`/api/download/${fileId}`, { headers: apiHeaders });
      if (!res.ok) throw new Error("Download failed");
      let buffer = await res.arrayBuffer();
      if (fileRecord?.encrypted && credentials?.password) {
        const key = await deriveKey(credentials.password);
        buffer = await decryptBuffer(buffer, key);
      }
      const url = URL.createObjectURL(new Blob([buffer]));
      const a = document.createElement("a"); a.href = url; a.download = base; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) { addToast(`Download failed: ${err.message}`, "error"); }
  }, [files, credentials, apiHeaders, addToast]);

  const handleFolderDownload = (folderName) => {
    const path = folderName;
    addToast(`Zipping ${folderName}/…`, "info");
    // For folder downloads with encryption, we'd need client-side zip. For now: server zip (unencrypted export).
    const url = new URL(`/api/download-folder`, window.location.origin);
    url.searchParams.set("path", path);
    window.location.href = url.toString();
  };

  const handleDeleteClick  = f => { setConfirmTarget({ type: "file",   file: f });                                                         setInspectedFile(null); };
  const handleFolderDelete = n => { const prefix = `${n}/`, count = files.filter(f => f.filename.startsWith(prefix)).length; setConfirmTarget({ type: "folder", name: n, prefix, count }); setFolderWindow(null); };

  const handleConfirm = async () => {
    const t = confirmTarget; setConfirmTarget(null);
    if (t.type === "file") {
      try {
        const res = await fetch(`/api/delete/${t.file.id}`, { method: "DELETE", headers: apiHeaders });
        if (!res.ok) throw new Error();
        setFiles(p => p.filter(f => f.id !== t.file.id));
        addToast(`${t.file.filename.split("/").pop()} deleted`, "success");
      } catch { addToast("Delete failed", "error"); }
    } else {
      const toDelete = files.filter(f => f.filename.startsWith(t.prefix));
      await Promise.allSettled(toDelete.map(f => fetch(`/api/delete/${f.id}`, { method: "DELETE", headers: apiHeaders })));
      setFiles(p => p.filter(f => !f.filename.startsWith(t.prefix)));
      addToast(`Folder "${t.name}" deleted`, "success");
    }
  };

  const logout = () => {
    sessionStorage.removeItem("du_token"); sessionStorage.removeItem("du_channel_id"); sessionStorage.removeItem("du_password");
    setCredentials(null); setFiles([]); setFolderWindow(null);
  };

  // Root-level items for desktop
  const { folders: rootFolders, files: rootFiles } = useMemo(() => getItemsAtPath(files, ""), [files]);
  const q = search.toLowerCase();
  const visibleFolders = q ? [] : rootFolders;
  const visibleFiles   = q ? files.filter(f => f.filename.toLowerCase().includes(q)) : rootFiles;

  if (!hydrated) return null;
  if (!credentials) return <LoginScreen onLogin={setCredentials}/>;

  return (
    <>

      {isDragging && (
        <div className="drag-overlay">
          <Upload size={52} strokeWidth={1.5}/>
          <p>Drop to upload{folderWindow ? ` into ${folderWindow.name}/` : ""}</p>
        </div>
      )}

      {inspectedFile && <FileInspector file={inspectedFile} onClose={() => setInspectedFile(null)} onDownload={handleDownload} onDelete={handleDeleteClick}/>}

      {folderWindow && (
        <FolderWindow folder={folderWindow} allFiles={files} onClose={() => setFolderWindow(null)} onDownload={handleDownload} onDelete={handleDeleteClick} onDeleteFolder={handleFolderDelete}/>
      )}

      {confirmTarget?.type === "file" && (
        <ConfirmDialog title="Delete File" body={<>Delete <strong style={{ color:"var(--text-main)" }}>{confirmTarget.file.filename.split("/").pop()}</strong>? This also removes it from Discord.</>} onConfirm={handleConfirm} onCancel={() => setConfirmTarget(null)}/>
      )}
      {confirmTarget?.type === "folder" && (
        <ConfirmDialog title="Delete Folder" body={<>Delete <strong style={{ color:"var(--text-main)" }}>{confirmTarget.name}/</strong> and all <strong style={{ color:"var(--text-main)" }}>{confirmTarget.count} files</strong> inside?</>} onConfirm={handleConfirm} onCancel={() => setConfirmTarget(null)}/>
      )}

      <Toast toasts={toasts} dismiss={dismissToast}/>
      <MenuBar search={search} onSearch={setSearch} view={view} onLogout={logout} hasEncryption={!!credentials.password}/>

      {/* Floating uploads */}
      {Object.keys(uploads).length > 0 && (
        <div className="uploads-float">
          {Object.entries(uploads).map(([uid, u]) => (
            <div key={uid} className="upload-row">
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.3rem" }}>
                <span style={{ fontSize:"0.72rem", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:170 }}>{u.name.split("/").pop()}</span>
                <span style={{ fontSize:"0.7rem", color: u.status==="error"?"var(--danger)":u.status==="done"?"var(--success)":u.status==="encrypting"?"#c084fc":"var(--text-muted)" }}>
                  {u.status==="error"?"✗":u.status==="done"?"✓":u.status==="encrypting"?"🔐":`${u.progress}%`}
                </span>
              </div>
              <div className="progress-container"><div className="progress-bar" style={{ width:`${u.progress}%`, background: u.status==="error"?"var(--danger)":u.status==="done"?"var(--success)":u.status==="encrypting"?"#c084fc":"var(--accent)" }}/></div>
            </div>
          ))}
        </div>
      )}

      {view === "stats" ? <StatsView files={files}/> : (
        <div className="desktop-surface" style={{ position:"relative" }}>
          {visibleFolders.length === 0 && visibleFiles.length === 0
            ? <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"0.75rem", color:"var(--text-muted)", pointerEvents:"none" }}>
                <Folder size={52} strokeWidth={1} color="rgba(255,255,255,0.06)"/>
                <p style={{ fontSize:"0.875rem" }}>{q ? `No results for "${q}"` : "Drop files here or use Upload"}</p>
              </div>
            : <div className="desktop-icon-grid">
                {visibleFolders.map(name => (
                  <DesktopFolderIcon key={name} name={name} onClick={() => setFolderWindow({ name, path: name })} onDownload={handleFolderDownload} onDelete={handleFolderDelete}/>
                ))}
                {visibleFiles.map(file => (
                  <DesktopFileIcon key={file.id} file={file} displayName={file.filename.split("/").pop()} showPath={!!q} onInspect={() => setInspectedFile(file)} onDownload={handleDownload} onDelete={handleDeleteClick}/>
                ))}
              </div>
          }
        </div>
      )}

      <Dock view={view} onView={setView} onUploadFiles={() => fileInputRef.current?.click()} onUploadFolder={() => folderInputRef.current?.click()}/>
      <input type="file" ref={fileInputRef}   onChange={e => { if (e.target.files?.length) handleFilesSelected(e.target.files, false); }} className="hidden-input" multiple/>
      <input type="file" ref={folderInputRef} onChange={e => { if (e.target.files?.length) handleFilesSelected(e.target.files, true);  }} className="hidden-input" webkitdirectory="" directory=""/>
    </>
  );
}
