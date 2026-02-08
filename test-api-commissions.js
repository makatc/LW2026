const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImRhMDMxZWNjLTk4ODEtNGQ4ZC1iYjdmLTNlYmNhODdjN2YyOCIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3Mzg5NjExMDY3OTksImV4cCI6MTczOTU2NTkwNjc5OX0.HvKqYTRabsCn7lwcgHjBJ4gRZb0W0UQCG8b9RPphZ2w';
const url = 'http://localhost:3001/config/commissions/all';

console.log('Fetching commissions from API...');
console.log('URL:', url);

fetch(url, {
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
})
    .then(res => {
        console.log('Status:', res.status);
        console.log('Status Text:', res.statusText);
        return res.json();
    })
    .then(data => {
        console.log('Response data:', JSON.stringify(data, null, 2));
        if (Array.isArray(data)) {
            console.log(`Found ${data.length} commissions`);
            if (data.length > 0) {
                console.log('First commission:', data[0]);
            }
        } else {
            console.log('Response is not an array:', typeof data);
        }
    })
    .catch(err => {
        console.error('Error:', err.message);
    });
