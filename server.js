const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { authenticate, getUserIdFromToken } = require('./auth');

const usersPath = path.join(__dirname, 'users.json');
const sharesPath = path.join(__dirname, 'data', 'share.json');

function loadShares() {
    if (!fs.existsSync(sharesPath)) return {};
    return JSON.parse(fs.readFileSync(sharesPath, 'utf-8'));
}

function saveShares(shares) {
    fs.writeFileSync(sharesPath, JSON.stringify(shares, null, 2));
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

        fs.readdir(userDir, (err, files) => {
            if (err) {
                res.writeHead(500);
                return res.end('Erreur lecture');
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(files));
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
    else if (req.method === 'GET' && req.url === '/files') {
        const userId = extractUserId(req);
        if (!userId) {
            res.writeHead(401);
            return res.end('Unauthorized');
        }

        const userDir = path.join(__dirname, 'data', userId);
        if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

        const sharedFiles = [];
        const shares = loadShares();
        const sharedFrom = shares.filter(s => s.sharedWith === userId);

        sharedFrom.forEach(share => {
            const sharedDir = path.join(__dirname, 'data', share.owner);
            if (fs.existsSync(sharedDir)) {
                const files = fs.readdirSync(sharedDir).map(f => `[Partagé par ${share.owner}] ${f}`);
                sharedFiles.push(...files);
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
    else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Bienvenue dans le gestionnaire de fichiers !');
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