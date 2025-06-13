const token = localStorage.getItem('token');
const fileList = document.getElementById('fileList');
const notifList = document.getElementById('notifList');

if (!token) {
    alert("Non authentifié. Redirection...");
    window.location.href = 'login.html';
}

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

async function uploadFile() {
    const input = document.getElementById('uploadInput');
    const file = input.files[0];
    if (!file) return alert('Aucun fichier sélectionné');

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('http://localhost:3000/upload', {
        method: 'POST',
        headers: { 'Authorization': token },
        body: formData
    });

    if (res.ok) {
        alert('Fichier téléversé');
        loadFiles();
    } else {
        alert('Erreur lors de l\'upload');
    }
}

async function compress() {
    const res = await fetch('http://localhost:3000/compress', {
        method: 'POST',
        headers: { 'Authorization': token }
    });

    if (res.ok) {
        alert('Compression lancée');
    } else {
        alert('Erreur compression');
    }
}

function connectWebSocket() {
    const socket = new WebSocket('ws://localhost:8081');

    socket.onopen = () => {
        socket.send(JSON.stringify({ token }));
    };

    socket.onmessage = event => {
        const data = JSON.parse(event.data);
        const li = document.createElement('li');
        li.textContent = data.message || 'Notification reçue';
        notifList.appendChild(li);
    };

    socket.onerror = () => {
        const li = document.createElement('li');
        li.textContent = 'Erreur WebSocket';
        notifList.appendChild(li);
    };
}

// Initialisation
loadFiles();
connectWebSocket();
