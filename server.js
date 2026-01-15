const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const server = http.createServer((req, res) => {
  try {
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);

    // Remove query parameters
    filePath = filePath.split('?')[0];

    const extname = path.extname(filePath).toLowerCase();
    let contentType = 'text/html';

    const mimeTypes = {
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.json': 'application/json',
    };

    contentType = mimeTypes[extname] || 'text/html';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end('<h1>404 - Not Found</h1>', 'utf-8');
        } else {
          res.writeHead(500);
          res.end('Server error', 'utf-8');
        }
      } else {
        // Add no-cache headers to prevent browser caching
        res.writeHead(200, { 
          'Content-Type': contentType,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.end(content, 'utf-8');
      }
    });
  } catch (err) {
    console.error('Request error:', err);
    res.writeHead(500);
    res.end('Server error', 'utf-8');
  }
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(Server running at http://localhost:/);
  console.log(Open browser at: http://localhost:/);
  console.log('Press Ctrl+C to stop the server');
});
