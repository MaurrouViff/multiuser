const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { authenticate, getUserIdFromToken } = require('./auth');

// Créer un serveur HTTP de base
const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/login') {
        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', () => {
            const { username, password } = JSON.parse(body);
            const token = authenticate(username, password);
            if (token) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ token }));
            } else {
                res.writeHead(401);
                res.end('Unauthorized');
            }
        });
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Bienvenue dans le gestionnaire de fichiers !');
    }
});

// Créer un serveur WebSocket
const wss = new WebSocket.Server({ server });

// Lorsqu'une connexion WebSocket est établie
wss.on('connection', (ws) => {
    console.log('Un utilisateur s\'est connecté');

    // Message de bienvenue à la connexion
    ws.send('Connecté à WebSocket. Veuillez envoyer votre token pour vous authentifier.');

    // Quand on reçoit un message depuis un client WebSocket
    ws.on('message', (message) => {
        console.log(`Message reçu : ${message}`);

        const { token } = JSON.parse(message);

        // Vérifier le token d'authentification
        const userId = getUserIdFromToken(token);

        if (userId) {
            ws.send(JSON.stringify({ status: 'success', message: 'Authentification réussie' }));
            console.log(`Utilisateur authentifié : ${userId}`);
        } else {
            ws.send(JSON.stringify({ status: 'error', message: 'Échec de l\'authentification' }));
        }
    });

    // Gérer la déconnexion de l'utilisateur
    ws.on('close', () => {
        console.log('Un utilisateur s\'est déconnecté');
    });

    // Gestion des erreurs
    ws.on('error', (error) => {
        console.error('Erreur WebSocket:', error);
    });
});

// Démarrer le serveur HTTP + WebSocket sur le même port
server.listen(3000, () => {
    console.log('Serveur démarré sur http://localhost:3000');
});
