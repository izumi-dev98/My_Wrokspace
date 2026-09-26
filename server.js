import express from 'express';
import cors from 'cors';
import { createReadStream, createWriteStream, statSync, readdirSync, mkdirSync, existsSync, unlinkSync, renameSync, cpSync, writeFileSync, readFileSync } from 'fs';
import { join, resolve, relative, extname, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import simpleGit from 'simple-git';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKSPACE_ROOT = resolve(__dirname);
const PORT = 3001;

const app = express();
const git = simpleGit(WORKSPACE_ROOT);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ========== FILE SYSTEM API ==========

// Get directory tree
app.get('/api/tree', (req, res) => {
  const requestedPath = req.query.path || '.';
  const fullPath = resolve(WORKSPACE_ROOT, requestedPath);
  
  if (!fullPath.startsWith(WORKSPACE_ROOT)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  if (!existsSync(fullPath)) {
    return res.status(404).json({ error: 'Not found' });
  }
  
  try {
    const tree = buildTree(fullPath, requestedPath);
    res.json(tree);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function buildTree(fullPath, relativePath) {
  const stats = statSync(fullPath);
  const name = basename(fullPath) || 'My_Workspace';
  const isDir = stats.isDirectory();
  
  const node = {
    name,
    path: relativePath,
    fullPath,
    isDir,
    size: stats.size,
    modified: stats.mtime,
    extension: isDir ? null : extname(fullPath).toLowerCase()
  };
  
  if (isDir) {
    try {
      const children = readdirSync(fullPath)
        .filter(f => !f.startsWith('.') && f !== 'node_modules' && f !== 'dist')
        .map(child => buildTree(join(fullPath, child), join(relativePath, child)));
      node.children = children;
    } catch (err) {
      node.children = [];
    }
  }
  
  return node;
}

// Read file content
app.get('/api/file', (req, res) => {
  const requestedPath = req.query.path;
  if (!requestedPath) return res.status(400).json({ error: 'Path required' });
  
  const fullPath = resolve(WORKSPACE_ROOT, requestedPath);
  if (!fullPath.startsWith(WORKSPACE_ROOT)) return res.status(403).json({ error: 'Access denied' });
  if (!existsSync(fullPath)) return res.status(404).json({ error: 'Not found' });
  
  const stats = statSync(fullPath);
  if (stats.isDirectory()) return res.status(400).json({ error: 'Is a directory' });
  
  const textExtensions = ['.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.csv', '.xml', '.yaml', '.yml', '.ini', '.conf', '.log', '.py', '.sh', '.bat', '.ps1', '.sql', '.dockerfile', '.gitignore', '.env'];
  const ext = extname(fullPath).toLowerCase();
  const isText = textExtensions.includes(ext) || stats.size < 1024 * 1024;
  
  if (isText) {
    try {
      const content = readFileSync(fullPath, 'utf-8');
      res.json({ content, isText: true, size: stats.size, modified: stats.mtime });
    } catch (err) {
      res.json({ isText: false, size: stats.size, modified: stats.mtime, binary: true });
    }
  } else {
    res.json({ isText: false, size: stats.size, modified: stats.mtime, binary: true });
  }
});

// Download file
app.get('/api/download', (req, res) => {
  const requestedPath = req.query.path;
  if (!requestedPath) return res.status(400).json({ error: 'Path required' });
  
  const fullPath = resolve(WORKSPACE_ROOT, requestedPath);
  if (!fullPath.startsWith(WORKSPACE_ROOT)) return res.status(403).json({ error: 'Access denied' });
  if (!existsSync(fullPath)) return res.status(404).json({ error: 'Not found' });
  
  res.download(fullPath, basename(fullPath));
});

// Save file (create or update)
app.post('/api/file', (req, res) => {
  const { path, content } = req.body;
  if (!path) return res.status(400).json({ error: 'Path required' });
  
  const fullPath = resolve(WORKSPACE_ROOT, path);
  if (!fullPath.startsWith(WORKSPACE_ROOT)) return res.status(403).json({ error: 'Access denied' });
  
  try {
    const dir = dirname(fullPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    
    writeFileSync(fullPath, content || '', 'utf-8');
    res.json({ success: true, path });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete file/folder
app.delete('/api/file', (req, res) => {
  const { path } = req.body;
  if (!path) return res.status(400).json({ error: 'Path required' });
  
  const fullPath = resolve(WORKSPACE_ROOT, path);
  if (!fullPath.startsWith(WORKSPACE_ROOT)) return res.status(403).json({ error: 'Access denied' });
  if (!existsSync(fullPath)) return res.status(404).json({ error: 'Not found' });
  
  try {
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      const deleteFolder = (p) => {
        readdirSync(p).forEach(f => {
          const fp = join(p, f);
          if (statSync(fp).isDirectory()) deleteFolder(fp);
          else unlinkSync(fp);
        });
        unlinkSync(p);
      };
      deleteFolder(fullPath);
    } else {
      unlinkSync(fullPath);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rename/move
app.put('/api/file/rename', (req, res) => {
  const { oldPath, newPath } = req.body;
  if (!oldPath || !newPath) return res.status(400).json({ error: 'Both paths required' });
  
  const fullOld = resolve(WORKSPACE_ROOT, oldPath);
  const fullNew = resolve(WORKSPACE_ROOT, newPath);
  
  if (!fullOld.startsWith(WORKSPACE_ROOT) || !fullNew.startsWith(WORKSPACE_ROOT)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  try {
    const newDir = dirname(fullNew);
    if (!existsSync(newDir)) mkdirSync(newDir, { recursive: true });
    renameSync(fullOld, fullNew);
    res.json({ success: true, newPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== GIT API ==========

// Git status
app.get('/api/git/status', async (req, res) => {
  try {
    const status = await git.status();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Git diff
app.get('/api/git/diff', async (req, res) => {
  try {
    const { file } = req.query;
    let diff;
    if (file) {
      diff = await git.diff([file]);
    } else {
      diff = await git.diff();
    }
    res.json({ diff });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Git log
app.get('/api/git/log', async (req, res) => {
  try {
    const log = await git.log({ maxCount: 20 });
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stage files
app.post('/api/git/stage', async (req, res) => {
  try {
    const { files } = req.body;
    if (files && files.length > 0) {
      await git.add(files);
    } else {
      await git.add('.');
    }
    const status = await git.status();
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unstage files
app.post('/api/git/unstage', async (req, res) => {
  try {
    const { files } = req.body;
    if (files && files.length > 0) {
      await git.reset(files);
    } else {
      await git.reset();
    }
    const status = await git.status();
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Commit
app.post('/api/git/commit', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Commit message required' });
    
    await git.commit(message);
    const status = await git.status();
    const log = await git.log({ maxCount: 1 });
    res.json({ success: true, status, commit: log.latest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Push
app.post('/api/git/push', async (req, res) => {
  try {
    const { remote = 'origin', branch = 'master' } = req.body;
    await git.push(remote, branch);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pull
app.post('/api/git/pull', async (req, res) => {
  try {
    const { remote = 'origin', branch = 'master' } = req.body;
    await git.pull(remote, branch);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== WORKSPACE INFO ==========
app.get('/api/workspace', (req, res) => {
  res.json({
    root: WORKSPACE_ROOT,
    name: 'My_Workspace'
  });
});

// Serve static files from dist (after build)
app.use(express.static(join(__dirname, 'dist')));

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Workspace Control Panel running at http://localhost:${PORT}`);
  console.log(`📁 Workspace: ${WORKSPACE_ROOT}`);
});