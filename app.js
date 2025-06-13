const token = localStorage.getItem('token');
const fileList = document.getElementById('fileList');
const notifList = document.getElementById('notifList');
const ownFileList = document.getElementById('ownFileList');
const sharedFileList = document.getElementById('sharedFileList');

if (!token) {
    alert("Non authentifié. Redirection...");
    window.location.href = 'login.html';
}
async function loadFiles() {
    const res = await fetch('http://localhost:3000/files', {
        headers: { 'Authorization': token }
    });

    if (!res.ok) {
        ownFileList.innerHTML = '<li>Erreur de chargement</li>';
        sharedFileList.innerHTML = '';
        return;
    }

    const files = await res.json();
    ownFileList.innerHTML = '';
    sharedFileList.innerHTML = '';

    files.forEach(f => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.textContent = f;
        link.href = getFileDownloadUrl(f);
        link.download = ''; // Indique au navigateur de télécharger
        link.addEventListener('click', e => {
            e.preventDefault();
            downloadFile(link.href, f);
        });

        li.appendChild(link);

        if (f.startsWith('[Partagé par ')) {
            sharedFileList.appendChild(li);
        } else {
            ownFileList.appendChild(li);
        }
    });
}

function getFileDownloadUrl(filename) {
    const isShared = filename.startsWith('[Partagé par ');
    if (isShared) {
        const matches = filename.match(/^\[Partagé par ([^\]]+)\] (.+)$/);
        if (!matches) return '#';
        const owner = encodeURIComponent(matches[1]);
        const file = encodeURIComponent(matches[2]);
        return `http://localhost:3000/file?name=${file}&sharedBy=${owner}`;
    } else {
        const file = encodeURIComponent(filename);
        return `http://localhost:3000/file?name=${file}`;
    }
}

function downloadFile(url, filename) {
    fetch(url, {
        headers: { 'Authorization': token }
    })
        .then(response => {
            if (!response.ok) throw new Error('Erreur téléchargement');
            return response.blob();
        })
        .then(blob => {
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename.replace(/^\[Partagé par [^\]]+\] /, '');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        })
        .catch(err => alert(err.message));
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
    window.socket = new WebSocket('ws://localhost:3000');

    window.socket.onopen = () => {
        window.socket.send(JSON.stringify({ token }));
    };

    window.socket.onmessage = event => {
        let data;
        try {
            data = JSON.parse(event.data);
        } catch {
            // Si ce n'est pas un JSON, on crée un objet avec message texte brut
            data = { message: event.data };
        }

        const li = document.createElement('li');
        li.textContent = data.message || 'Notification reçue';
        notifList.appendChild(li);
    };

    window.socket.onerror = () => {
        const li = document.createElement('li');
        li.textContent = 'Erreur WebSocket';
        notifList.appendChild(li);
    };
}


// Initialisation
loadFiles();
connectWebSocket();
