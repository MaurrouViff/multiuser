document.getElementById('share-form').addEventListener('submit', async e => {
    e.preventDefault();

    const shareWithUserId = document.getElementById('shareWithUserId').value.trim();
    const resultDiv = document.getElementById('share-result');
    resultDiv.textContent = '';
    resultDiv.style.color = 'black';

    if (!shareWithUserId) {
        resultDiv.textContent = 'Veuillez saisir un ID utilisateur.';
        resultDiv.style.color = 'red';
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        resultDiv.textContent = 'Vous devez être connecté.';
        resultDiv.style.color = 'red';
        return;
    }

    try {
        const res = await fetch('http://localhost:3000/share', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token
            },
            body: JSON.stringify({ shareWithUserId })
        });

        if (res.ok) {
            const data = await res.json();
            resultDiv.style.color = 'green';
            resultDiv.textContent = `Dossier partagé avec ${shareWithUserId}`;

            // Optionnel : envoyer une notification via WebSocket si socket est accessible
            if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                window.socket.send(JSON.stringify({
                    type: 'share',
                    message: `Votre dossier a été partagé avec ${shareWithUserId}`
                }));
            }
        } else {
            const errorText = await res.text();
            resultDiv.style.color = 'red';
            resultDiv.textContent = `Erreur : ${errorText}`;
        }
    } catch (err) {
        resultDiv.style.color = 'red';
        resultDiv.textContent = 'Erreur réseau, veuillez réessayer.';
    }
});
