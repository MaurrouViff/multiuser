document.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch('http://localhost:3000/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        console.log('Status:', res.status);

        if (res.ok) {
            const data = await res.json();
            console.log('Réponse JSON:', data);
            localStorage.setItem('token', data.token);
            window.location.href = 'index.html';
        } else {
            alert('Identifiants incorrects');
            console.log('Erreur serveur:', await res.text());
        }
    } catch (err) {
        alert('Erreur réseau');
        console.error('Erreur fetch:', err);
    }
});
