// Prueba simple del endpoint
const token = localStorage.getItem('access_token');
console.log('Token:', token ? 'Found' : 'Not found');

if (!token) {
    console.error('No token in localStorage');
} else {
    fetch('http://localhost:3001/config/commissions/seed-official', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
        .then(res => {
            console.log('Response status:', res.status);
            return res.text();
        })
        .then(text => {
            try {
                const data = JSON.parse(text);
                console.log('Success:', data.length, 'commissions');
            } catch (e) {
                console.error('Error response:', text);
            }
        })
        .catch(err => console.error('Network error:', err));
}
