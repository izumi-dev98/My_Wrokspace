import { useState, useEffect, useRef } from 'react';

const API = '/api';

function App() {
  const [tree, setTree] = useState(null);
  const [selectedPath, setSelectedPath] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [fileInfo, setFileInfo] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gitStatus, setGitStatus] = useState(null);
  const [gitLog, setGitLog] = useState([]);
  const [commitMsg, setCommitMsg] = useState('');
  const [pushPullStatus, setPushPullStatus] = useState('');
  const [activeTab, setActiveTab] = useState('files'); // files, git, notes
  const [expandedFolders, setExpandedFolders] = useState(new Set(['.']));
  const [newNoteContent, setNewNoteContent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef(null);

  // Load tree on mount
  useEffect(() => {
    loadTree();
    loadGitStatus();
    loadGitLog();
  }, []);

  // Watch for file changes (polling)
  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedPath && isEditing) return; // Don't refresh while editing
      loadTree();
      loadGitStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedPath, isEditing]);

  async function loadTree() {
    try {
      const res = await fetch(`${API}/tree`);
      const data = await res.json();
      setTree(data);
    } catch (err) {
      console.error('Failed to load tree:', err);
    }
  }

  async function loadGitStatus() {
    try {
      const res = await fetch(`${API}/git/status`);
      const data = await res.json();
      setGitStatus(data);
    } catch (err) {
      console.error('Failed to load git status:', err);
    }
  }

  async function loadGitLog() {
    try {
      const res = await fetch(`${API}/git/log`);
      const data = await res.json();
      setGitLog(data.all || []);
    } catch (err) {
      console.error('Failed to load git log:', err);
    }
  }

  async function selectFile(node) {
    if (node.isDir) {
      toggleFolder(node.path);
      return;
    }
    
    setSelectedPath(node.path);
    setIsEditing(false);
    
    try {
      const res = await fetch(`${API}/file?path=${encodeURIComponent(node.path)}`);
      const data = await res.json();
      if (data.isText) {
        setFileContent(data.content);
        setFileInfo(data);
        setIsEditing(true);
      } else {
        setFileContent('[Binary file - cannot display]');
        setFileInfo(data);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Failed to load file:', err);
    }
  }

  function toggleFolder(path) {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  async function saveFile() {
    if (!selectedPath) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedPath, content: fileContent })
      });
      const data = await res.json();
      if (data.success) {
        alert('Saved!');
        loadGitStatus();
      }
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function createFile(folderPath, name, content = '') {
    const path = folderPath === '.' ? name : `${folderPath}/${name}`;
    try {
      const res = await fetch(`${API}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content })
      });
      const data = await res.json();
      if (data.success) {
        loadTree();
        setSelectedPath(path);
        setFileContent(content);
        setIsEditing(true);
      }
    } catch (err) {
      alert('Create failed: ' + err.message);
    }
  }

  async function createFolder(folderPath, name) {
    const path = folderPath === '.' ? name : `${folderPath}/${name}`;
    try {
      const res = await fetch(`${API}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content: '' })
      });
      loadTree();
    } catch (err) {
      alert('Create folder failed: ' + err.message);
    }
  }

  async function deleteItem(path) {
    if (!confirm(`Delete ${path}?`)) return;
    try {
      await fetch(`${API}/file`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      loadTree();
      loadGitStatus();
      if (selectedPath === path) {
        setSelectedPath(null);
        setFileContent('');
        setIsEditing(false);
      }
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  async function renameItem(oldPath, newName) {
    const newPath = oldPath.includes('/') 
      ? oldPath.substring(0, oldPath.lastIndexOf('/') + 1) + newName 
      : newName;
    try {
      const res = await fetch(`${API}/file/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath, newPath })
      });
      loadTree();
      loadGitStatus();
    } catch (err) {
      alert('Rename failed: ' + err.message);
    }
  }

  function handleUpload(folderPath, files) {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const path = folderPath === '.' ? file.name : `${folderPath}/${file.name}`;
        try {
          await fetch(`${API}/file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content: e.target.result })
          });
          loadTree();
          loadGitStatus();
        } catch (err) {
          console.error('Upload failed:', err);
        }
      };
      reader.readAsText(file);
    });
  }

  // Git operations
  async function stageFiles(files = ['.']) {
    try {
      await fetch(`${API}/git/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files })
      });
      loadGitStatus();
    } catch (err) {
      alert('Stage failed: ' + err.message);
    }
  }

  async function unstageFiles(files = []) {
    try {
      await fetch(`${API}/git/unstage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files })
      });
      loadGitStatus();
    } catch (err) {
      alert('Unstage failed: ' + err.message);
    }
  }

  async function doCommit() {
    if (!commitMsg.trim()) return alert('Enter commit message');
    try {
      await fetch(`${API}/git/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commitMsg })
      });
      setCommitMsg('');
      loadGitStatus();
      loadGitLog();
    } catch (err) {
      alert('Commit failed: ' + err.message);
    }
  }

  async function doPush() {
    setPushPullStatus('Pushing...');
    try {
      await fetch(`${API}/git/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remote: 'origin', branch: 'master' })
      });
      setPushPullStatus('Push successful!');
      loadGitStatus();
      loadGitLog();
    } catch (err) {
      setPushPullStatus('Push failed: ' + err.message);
    }
    setTimeout(() => setPushPullStatus(''), 3000);
  }

  async function doPull() {
    setPushPullStatus('Pulling...');
    try {
      await fetch(`${API}/git/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remote: 'origin', branch: 'master' })
      });
      setPushPullStatus('Pull successful!');
      loadTree();
      loadGitStatus();
      loadGitLog();
    } catch (err) {
      setPushPullStatus('Pull failed: ' + err.message);
    }
    setTimeout(() => setPushPullStatus(''), 3000);
  }

  // Notes feature
  async function saveNote() {
    if (!newNoteContent.trim()) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `note-${timestamp}.md`;
    await createFile('notes', filename, newNoteContent);
    setNewNoteContent('');
  }

  function renderTreeNode(node, depth = 0) {
    if (node.path !== '.' && searchTerm && !node.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return null;
    }

    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedPath === node.path;
    const isTextFile = !node.isDir && ['.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.py', '.csv'].includes(node.extension || '');

    return (
      <div key={node.path} style={{ paddingLeft: depth * 20 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 8px',
            background: isSelected ? '#e3f2fd' : 'transparent',
            borderRadius: 4,
            cursor: 'pointer',
            transition: 'background 0.1s'
          }}
          onClick={() => node.isDir ? toggleFolder(node.path) : selectFile(node)}
          onContextMenu={(e) => {
            e.preventDefault();
            showContextMenu(e, node);
          }}
        >
          {node.isDir && (
            <span onClick={(e) => { e.stopPropagation(); toggleFolder(node.path); }} style={{ marginRight: 4 }}>
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          {!node.isDir && <span style={{ marginRight: 4 }}>📄</span>}
          <span style={{ flex: 1, fontFamily: isTextFile ? 'monospace' : 'inherit' }}>
            {node.name}
          </span>
          {!node.isDir && node.size > 0 && (
            <span style={{ fontSize: 11, color: '#666', marginLeft: 8 }}>
              {formatSize(node.size)}
            </span>
          )}
        </div>
        {node.isDir && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, node: null });

  function showContextMenu(e, node) {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, node });
  }

  function hideContextMenu() {
    setContextMenu({ visible: false, x: 0, y: 0, node: null });
  }

  useEffect(() => {
    function handleClick() { hideContextMenu(); }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f5f5f5' }}>
      {/* Sidebar */}
      <div style={{ 
        width: 320, 
        background: '#fff', 
        borderRight: '1px solid #ddd',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #ddd' }}>
          {['files', 'git', 'notes'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '10px',
                border: 'none',
                background: activeTab === tab ? '#fff' : '#f5f5f5',
                borderBottom: activeTab === tab ? '2px solid #1976d2' : 'none',
                cursor: 'pointer',
                fontWeight: activeTab === tab ? 600 : 400
              }}
            >
              {tab === 'files' && '📁 Files'}
              {tab === 'git' && '📦 Git'}
              {tab === 'notes' && '📝 Notes'}
            </button>
          ))}
        </div>

        {/* Files Tab */}
        {activeTab === 'files' && (
          <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
            <div style={{ marginBottom: 8 }}>
              <input
                type="text"
                placeholder="🔍 Search files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', border: '1px solid #ddd', borderRadius: 4, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 8, padding: '0 4px' }}>
              {tree?.name} ({tree?.children?.length || 0} items)
            </div>
            {tree && renderTreeNode(tree)}
          </div>
        )}

        {/* Git Tab */}
        {activeTab === 'git' && (
          <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
            <div style={{ marginBottom: 12 }}>
              <h4 style={{ margin: '0 0 8px' }}>Status</h4>
              {gitStatus && (
                <div style={{ fontSize: 13, fontFamily: 'monospace' }}>
                  <div style={{ color: '#c62828' }}>Modified: {gitStatus.modified?.length || 0}</div>
                  <div style={{ color: '#2e7d32' }}>Staged: {gitStatus.staged?.length || 0}</div>
                  <div style={{ color: '#f57c00' }}>Not staged: {gitStatus.not_added?.length || 0}</div>
                  <div style={{ color: '#7b1fa2' }}>Conflicted: {gitStatus.conflicted?.length || 0}</div>
                  <div style={{ color: '#555' }}>Branch: {gitStatus.current}</div>
                </div>
              )}
            </div>

            {gitStatus?.staged?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 8px', color: '#2e7d32' }}>Staged Changes</h4>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                  {gitStatus.staged.map(f => (
                    <li key={f} style={{ color: '#2e7d32' }} onClick={() => unstageFiles([f])}>
                      {f} (click to unstage)
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {gitStatus?.modified?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 8px', color: '#c62828' }}>Modified (Unstaged)</h4>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                  {gitStatus.modified.map(f => (
                    <li key={f} style={{ color: '#c62828' }} onClick={() => stageFiles([f])}>
                      {f} (click to stage)
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {gitStatus?.not_added?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <h4 style={{ margin: '0 0 8px', color: '#f57c00' }}>Untracked</h4>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                  {gitStatus.not_added.map(f => (
                    <li key={f} style={{ color: '#f57c00' }} onClick={() => stageFiles([f])}>
                      {f} (click to stage)
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <h4 style={{ margin: '0 0 8px' }}>Commit</h4>
              <textarea
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                placeholder="Commit message..."
                style={{ width: '100%', height: 60, padding: 8, border: '1px solid #ddd', borderRadius: 4, boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 13 }}
              />
              <button
                onClick={doCommit}
                style={{ marginTop: 8, padding: '8px 16px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Commit
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={doPush} style={{ flex: 1, padding: '10px', background: '#388e3c', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                Push to GitHub
              </button>
              <button onClick={doPull} style={{ flex: 1, padding: '10px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                Pull from GitHub
              </button>
            </div>

            {pushPullStatus && (
              <div style={{ marginTop: 12, padding: 8, background: pushPullStatus.includes('failed') ? '#ffebee' : '#e8f5e9', borderRadius: 4, fontSize: 13 }}>
                {pushPullStatus}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <h4 style={{ margin: '0 0 8px' }}>Recent Commits</h4>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12 }}>
                {gitLog.slice(0, 10).map((commit, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    <span style={{ color: '#1976d2' }}>{commit.hash?.substring(0, 7)}</span> 
                    {commit.message} <span style={{ color: '#999' }}>({commit.date})</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
            <h4 style={{ margin: '0 0 12px' }}>Quick Notes</h4>
            <textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Write a quick note... (saved as .md in notes/)"
              style={{ width: '100%', height: 200, padding: 10, border: '1px solid #ddd', borderRadius: 4, boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5, resize: 'vertical' }}
            />
            <button
              onClick={saveNote}
              style={{ marginTop: 8, padding: '10px 16px', background: '#7b1fa2', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', width: '100%' }}
            >
              Save Note
            </button>
            <div style={{ marginTop: 16 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 13 }}>Recent Notes</h4>
              {tree?.children?.find(c => c.name === 'notes')?.children?.slice(-5).reverse().map(note => (
                <div key={note.path} style={{ padding: '8px', borderBottom: '1px solid #eee', fontSize: 13, cursor: 'pointer' }} onClick={() => selectFile(note)}>
                  📝 {note.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Context Menu */}
        {contextMenu.visible && contextMenu.node && (
          <div
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: 4,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 1000,
              minWidth: 160
            }}
          >
            {!contextMenu.node.isDir && (
              <button onClick={() => selectFile(contextMenu.node)} style={ctxMenuItemStyle}>Open</button>
            )}
            <button onClick={() => fileInputRef.current?.click()} style={ctxMenuItemStyle}>Upload File</button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => handleUpload(contextMenu.node.path, e.target.files)}
            />
            <button onClick={() => {
              const name = prompt('New file name:');
              if (name) createFile(contextMenu.node.path, name);
              hideContextMenu();
            }} style={ctxMenuItemStyle}>New File</button>
            <button onClick={() => {
              const name = prompt('New folder name:');
              if (name) createFolder(contextMenu.node.path, name);
              hideContextMenu();
            }} style={ctxMenuItemStyle}>New Folder</button>
            <hr style={{ margin: 4, borderColor: '#eee' }} />
            <button onClick={() => {
              const name = prompt('Rename to:', contextMenu.node.name);
              if (name) renameItem(contextMenu.node.path, name);
              hideContextMenu();
            }} style={ctxMenuItemStyle}>Rename</button>
            <button onClick={() => { deleteItem(contextMenu.node.path); hideContextMenu(); }} style={{ ...ctxMenuItemStyle, color: '#c62828' }}>
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        {/* Toolbar */}
        <div style={{ 
          padding: '12px 16px', 
          borderBottom: '1px solid #ddd', 
          background: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <span style={{ fontWeight: 500, color: selectedPath ? '#333' : '#999' }}>
            {selectedPath ? `📄 ${selectedPath}` : 'Select a file to edit'}
          </span>
          {selectedPath && isEditing && (
            <button onClick={saveFile} disabled={saving} style={{ padding: '8px 16px', background: '#388e3c', color: '#fff', border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : '💾 Save (Ctrl+S)'}
            </button>
          )}
        </div>

        {/* Editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {selectedPath && isEditing ? (
            <textarea
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              onKeyDown={(e) => { if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveFile(); }}}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                padding: 16,
                fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
                fontSize: 14,
                lineHeight: 1.6,
                resize: 'none',
                background: '#fafafa'
              }}
              spellCheck={false}
            />
          ) : selectedPath && !isEditing ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 14 }}>
              Binary file or unsupported format. <button onClick={() => window.open(`${API}/download?path=${encodeURIComponent(selectedPath)}`)} style={{ color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Download</button>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
              <div>Select a file from the sidebar to start editing</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>Right-click in file tree for more options</div>
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div style={{ 
          padding: '4px 16px', 
          borderTop: '1px solid #ddd', 
          background: '#fafafa',
          fontSize: 12,
          color: '#666',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <span>{fileInfo ? `Lines: ${fileContent.split('\n').length} | Chars: ${fileContent.length} | ${formatSize(fileInfo.size)}` : 'Ready'}</span>
          <span>Workspace Control Panel v1.0</span>
        </div>
      </div>
    </div>
  );
}

const ctxMenuItemStyle = {
  display: 'block',
  width: '100%',
  padding: '8px 12px',
  border: 'none',
  background: 'none',
  textAlign: 'left',
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: 'inherit'
};

export default App;