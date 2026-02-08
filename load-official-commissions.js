// Script to seed official commissions via API endpoint

async function login() {
    const res = await fetch('http://localhost:3001/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'admin@example.com',
            password: 'admin123'
        })
    });

    if (!res.ok) {
        throw new Error(`Login failed: ${res.statusText}`);
    }

    const data = await res.json();
    return data.access_token;
}

async function seedCommissions(token) {
    console.log('🌱 Cargando comisiones oficiales...\n');

    const res = await fetch('http://localhost:3001/config/commissions/seed-official', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Seed failed: ${res.status} - ${text}`);
    }

    const data = await res.json();
    console.log(`✅ ${data.length} comisiones cargadas exitosamente!\n`);

    // Group by category
    const byCategory = {};
    data.forEach(comm => {
        const cat = comm.category || 'Sin categoría';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(comm.name);
    });

    for (const [category, commissions] of Object.entries(byCategory)) {
        console.log(`\n📁 ${category} (${commissions.length}):`);
        commissions.forEach(name => console.log(`  - ${name}`));
    }
}

(async () => {
    try {
        const token = await login();
        console.log('✅ Login exitoso\n');
        await seedCommissions(token);
        console.log('\n🎉 ¡Proceso completado!');
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();
