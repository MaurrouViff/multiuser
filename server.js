const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { authenticate, getUserIdFromToken } = require('./auth');
const token = localStorage.getItem('token');
const { spawn, exec } = require('child_process');

const ownFileList = document.getElementById('ownFileList');
const sharedFileList = document.getElementById('sharedFileList');

const usersPath = path.join(__dirname, 'users.json');
const sharesPath = path.join(__dirname, 'data', 'share.json');

async function loadFiles() {
    const res = await fetch('http://localhost:3000/files', {
        headers: { 'Authorization': token }
    });

    if (res.ok) {
        const files = await res.json();
        fileList.innerHTML = '';
        files.forEach(f => {
            const li = document.createElement('li');
            li.textContent = f;
            fileList.appendChild(li);
        });
    } else {
        fileList.innerHTML = '<li>Erreur de chargement</li>';
    }
}


function saveShares(shares) {
    fs.writeFileSync(sharesPath, JSON.stringify(shares, null, 2));
}

function getSharedFilesForUser(userId) {
    const shareFilePath = path.join(__dirname, 'data', 'share.json');
    if (!fs.existsSync(shareFilePath)) return [];

    const shares = JSON.parse(fs.readFileSync(shareFilePath, 'utf-8'));
    const ownersWhoSharedWithMe = Object.entries(shares)
        .filter(([owner, sharedWith]) => sharedWith.includes(userId))
        .map(([owner]) => owner);

    const sharedFiles = [];

    ownersWhoSharedWithMe.forEach(owner => {
        const ownerDir = path.join(__dirname, 'data', owner);
        if (fs.existsSync(ownerDir)) {
            const files = fs.readdirSync(ownerDir).map(f => `[Partagé par ${owner}] ${f}`);
            sharedFiles.push(...files);
        }
    });

    return sharedFiles;
}


const server = http.createServer((req, res) => {
    // CORS - autoriser toutes origines (à adapter en prod)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Réponse rapide aux prévol OPTIONS CORS
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    // Fonction pour extraire userId à partir du token Authorization
    function extractUserId(req) {
        const token = req.headers['authorization'];
        if (!token) return null;
        return getUserIdFromToken(token);
    }

    // Gestion des routes
    if (req.method === 'POST' && req.url === '/login') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { username, password } = JSON.parse(body);
                const token = authenticate(username, password);
                if (token) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ token }));
                } else {
                    res.writeHead(401);
                    res.end('Unauthorized');
                }
            } catch {
                res.writeHead(400);
                res.end('Bad Request');
            }
        });
    }
    else if (req.method === 'GET' && req.url === '/files') {
        const userId = extractUserId(req);
        if (!userId) {
            res.writeHead(401);
            return res.end('Unauthorized');
        }

        const userDir = path.join(__dirname, 'data', userId);
        if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

        // Lire le fichier share.json
        const shareFilePath = path.join(__dirname, 'data', 'share.json');
        let shares = {};
        if (fs.existsSync(shareFilePath)) {
            const content = fs.readFileSync(shareFilePath, 'utf8');
            shares = content ? JSON.parse(content) : {};
        }

        const sharedFromUsers = shares[userId] || [];

        let sharedFiles = [];
        sharedFromUsers.forEach(ownerId => {
            const ownerDir = path.join(__dirname, 'data', ownerId);
            if (fs.existsSync(ownerDir)) {
                const ownerFiles = fs.readdirSync(ownerDir).map(f => `[Partagé par ${ownerId}] ${f}`);
                sharedFiles = sharedFiles.concat(ownerFiles);
            }
        });


        fs.readdir(userDir, (err, ownFiles) => {
            if (err) {
                res.writeHead(500);
                return res.end('Erreur lecture');
            }
            const allFiles = [...ownFiles, ...sharedFiles];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(allFiles));
        });
    }


    else if (req.method === 'GET' && req.url.startsWith('/file?name=')) {
        const userId = extractUserId(req);
        if (!userId) {
            res.writeHead(401);
            return res.end('Unauthorized');
        }

        const urlParams = new URLSearchParams(req.url.replace('/file?', ''));
        const fileName = urlParams.get('name');
        const sharedBy = urlParams.get('sharedBy'); // facultatif

        let filePath;
        if (sharedBy) {
            filePath = path.join(__dirname, 'data', sharedBy, fileName);
        } else {
            filePath = path.join(__dirname, 'data', userId, fileName);
        }

        if (!fs.existsSync(filePath)) {
            res.writeHead(404);
            return res.end('Fichier introuvable');
        }

        res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${fileName}"`
        });

        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    }

    else if (req.method === 'POST' && req.url === '/compress') {
        const userId = extractUserId(req);
        if (!userId) {
            res.writeHead(401);
            return res.end('Unauthorized');
        }

        const inputDir = path.join(__dirname, 'data', userId);
        const outputZip = path.join(__dirname, 'data', `${userId}.zip`);

        if (!fs.existsSync(inputDir)) {
            res.writeHead(404);
            return res.end('Dossier utilisateur introuvable');
        }

        // Compression avec spawn (zip -r)
        const zip = spawn('zip', ['-r', outputZip, '.', '-i', '*'], { cwd: inputDir });

        zip.on('close', code => {
            if (code === 0) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Compression réussie', zip: `${userId}.zip` }));
            } else {
                res.writeHead(500);
                res.end(`Erreur de compression (code ${code})`);
            }
        });

        zip.on('error', err => {
            res.writeHead(500);
            res.end('Erreur système : ' + err.message);
        });
    }
    else if (req.method === 'GET' && req.url.startsWith('/analyze')) {
        const userId = extractUserId(req);
        if (!userId) {
            res.writeHead(401);
            return res.end('Unauthorized');
        }

        const dirPath = path.join(__dirname, 'data', userId);

        exec(`ls -lh "${dirPath}"`, (err, stdout, stderr) => {
            if (err) {
                res.writeHead(500);
                return res.end('Erreur système : ' + stderr);
            }

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(stdout);
        });
    }



    else if (req.method === 'POST' && req.url === '/share') {
        const userId = extractUserId(req);
        console.log('POST /share reçu de', userId);

        if (!userId) {
            res.writeHead(401);
            return res.end('Unauthorized');
        }

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { shareWithUserId } = JSON.parse(body);

                if (!shareWithUserId) {
                    res.writeHead(400);
                    return res.end('ID utilisateur manquant');
                }

                const dataDir = path.join(__dirname, 'data');
                if (!fs.existsSync(dataDir)) {
                    fs.mkdirSync(dataDir);
                }

                let shares = loadShares();

                if (!shares[userId]) {
                    shares[userId] = [];
                }

                if (!shares[userId].includes(shareWithUserId)) {
                    shares[userId].push(shareWithUserId);
                }

                saveShares(shares);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: `Dossier partagé avec ${shareWithUserId}` }));
            } catch (err) {
                console.error('Erreur dans /share:', err);
                res.writeHead(400);
                res.end('Mauvais format JSON');
            }
        });
    }



    else if (req.method === 'POST' && req.url === '/upload') {
        const userId = extractUserId(req);
        if (!userId) {
            res.writeHead(401);
            return res.end('Unauthorized');
        }

        // Gérer upload multipart/form-data (exemple basique)
        const contentType = req.headers['content-type'] || '';
        const boundaryMatch = contentType.match(/boundary=(.+)$/);
        if (!boundaryMatch) {
            res.writeHead(400);
            return res.end('Bad Request: boundary not found');
        }

        const boundary = '--' + boundaryMatch[1];
        let rawData = Buffer.alloc(0);

        req.on('data', chunk => {
            rawData = Buffer.concat([rawData, chunk]);
        });

        req.on('end', () => {
            const parts = rawData.toString().split(boundary).filter(p => p.includes('filename='));
            parts.forEach(part => {
                const [rawHeaders, rawBody] = part.split('\r\n\r\n');
                if (!rawHeaders || !rawBody) return;

                const disposition = rawHeaders.match(/filename="(.+?)"/);
                if (!disposition) return;

                const filename = disposition[1];
                const bodyClean = rawBody.trimEnd().slice(0, -2); // enlever le \r\n final

                const userDir = path.join(__dirname, 'data', userId);
                if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

                const filePath = path.join(userDir, filename);
                fs.writeFileSync(filePath, bodyClean, 'binary');
            });

            res.writeHead(200);
            res.end('Upload terminé');
        });
    }
});

// Serveur WebSocket (même port)
const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
    console.log('Un utilisateur s\'est connecté');
    ws.send('Connecté à WebSocket. Veuillez envoyer votre token pour vous authentifier.');

    ws.on('message', message => {
        let data;
        try {
            data = JSON.parse(message);
        } catch {
            ws.send(JSON.stringify({ status: 'error', message: 'JSON invalide' }));
            return;
        }

        const userId = getUserIdFromToken(data.token);

        if (userId) {
            ws.send(JSON.stringify({ status: 'success', message: 'Authentification réussie' }));
            console.log(`Utilisateur authentifié : ${userId}`);
        } else {
            ws.send(JSON.stringify({ status: 'error', message: 'Échec de l\'authentification' }));
        }
    });

    ws.on('close', () => {
        console.log('Un utilisateur s\'est déconnecté');
    });

    ws.on('error', error => {
        console.error('Erreur WebSocket:', error);
    });
});

server.listen(3000, () => {
    console.log('Serveur démarré sur http://localhost:3000');
});