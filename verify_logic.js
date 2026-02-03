const { spin } = require('./src/utils/spintax');
// Mocking the random logic from whapiService
function testRandomDelay() {
    console.log("--- Teste de Pausa Aleatória (10 amostras) ---");
    for (let i = 0; i < 10; i++) {
        const minTime = 60000;
        const maxTime = 300000;
        const longPause = Math.floor(Math.random() * (maxTime - minTime + 1) + minTime); 
           
        const minutes = Math.floor(longPause / 60000);
        const seconds = Math.floor((longPause % 60000) / 1000);
        console.log(`Amostra ${i+1}: ${minutes}m ${seconds}s (${longPause}ms)`);
    }
}

// Mocking some templates
const templates = [
    `{Olá|Oi|Oiê|Saudações|Tudo bem}, {{nome}}! {👋|😀|🙂|👀}
{Identificamos|Verificamos|Consta no sistema|Notamos} que sua fatura de *R$ {{valor}}* (vencimento: {{data_vencimento}}) {está em atraso|ainda está pendente|consta em aberto|não foi compensada} há {{dias_atraso}} dias.`
];

function testSpintax() {
    console.log("\n--- Teste de Deep Spintax (3 variações) ---");
    const data = { nome: "Cliente Teste", valor: "99,90", data_vencimento: "05/02/2026", dias_atraso: "3" };
    
    templates.forEach(tmpl => {
        for (let i = 0; i < 3; i++) {
            let msg = tmpl;
            // Simple replace for test
            Object.keys(data).forEach(k => {
                msg = msg.replace(new RegExp(`{{${k}}}`, 'g'), data[k]);
            });
            console.log(`\n[Variação ${i+1}]:\n${spin(msg)}`);
        }
    });
}

testRandomDelay();
testSpintax();
