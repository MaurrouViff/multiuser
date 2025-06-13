# Gestionnaire de Fichiers Partagés

Ce projet est une application web de gestion de fichiers avec authentification, partage, téléchargement, compression et analyse via commandes système.

---

## Fonctionnalités principales

- Authentification par token JWT
- Upload, liste et téléchargement des fichiers
- Partage de fichiers entre utilisateurs
- Notification en temps réel via WebSocket
- Compression et analyse de fichiers via commandes système (ex: zip)
- Interface simple en HTML/JS côté client

---

## Prérequis

- Node.js (v14 ou plus récent recommandé)
- npm (gestionnaire de paquets Node)
- Accès terminal / console

---

## Installation

1. Cloner le dépôt :
   ```bash
   git clone https://github.com/MaurrouViff/multiuser
   cd multiuser
   ```
   
   ---

## 2. Installer les dépendances (seule dépendance autorisée est ws) :
npm install ws

---

## 3. Structure du projet
multiuser/<br>
│<br>
├── data/                # Données utilisateurs, fichiers, partages<br>
│   ├── share.json       # Fichier JSON des partages entre utilisateurs<br>
│   └── <user-id>/       # Dossiers utilisateurs contenant leurs fichiers<br>
│<br>
├── public/              # Fichiers frontend (HTML, CSS, JS)<br>
│   ├── index.html<br>
│   ├── app.js<br>
│   └── login.html<br>
│<br>
├── auth.js              # Module custom d’authentification et gestion token<br>
├── server.js            # Serveur HTTP natif + WebSocket<br>
├── package.json<br>
└── README.md<br>
---
## 4. Lancement du projet
Démarrer le serveur Node.js (par défaut sur le port 3000) :
node server.js
Ouvrir le navigateur et accéder à :
http://localhost:3000
Démarrer le projet:<br>
npx http-server . -p 8080<br>
pour accéder à la page index.html

## Utilisation
### Authentification
Se connecter via la page login.html avec un nom d’utilisateur et mot de passe définis dans users.json.

Un token est généré côté serveur et stocké localement côté client pour authentifier les requêtes.

### Gestion des fichiers
Télécharger, uploader des fichiers dans votre espace personnel.

Voir les fichiers partagés avec vous par d’autres utilisateurs.

Cliquer sur un fichier pour lancer son téléchargement.

###  Partage
Partager votre dossier avec d’autres utilisateurs via l’API /share.

Les fichiers des utilisateurs qui ont partagé avec vous apparaissent dans la section « Fichiers partagés ».

###  Notifications WebSocket
Notifications en temps réel sur événements serveur (ex: upload réussi).

###  Compression et analyse
Commande POST /compress : lance la compression (zip) de votre dossier utilisateur via une commande système.

Commande POST /analyse : lance un traitement système (exemple d’analyse) sur vos fichiers.

## 5. Détails techniques
Authentification : token simple stocké côté client, validé côté serveur sans JWT.

Upload : gestion manuelle du multipart/form-data sans bibliothèques externes.

Stockage : fichiers et données utilisateurs stockés uniquement dans le système de fichiers, pas de base de données.

Communication temps réel : via WebSocket avec la bibliothèque ws.

Compression/analyse : utilisation du module Node.js child_process pour exécuter des commandes système (zip, unzip, scripts personnalisés).

Sécurité : pas d’usage de frameworks HTTP externes, validation manuelle des tokens et chemins de fichiers.

## 7. Données
Elles sont stocké en json dans les différents fichiers comme users.json et share.json<br>
Les fichiers sont stocké dans le dossier "/data" 

## 8. Conclusion
Ce projet permet de faire un projet nodejs sans base de données, uniquement en json, codé en javascript.

# Projet fait par AUBRIET Aurélien, B3-ESGI spécialité Ingénierie du web.