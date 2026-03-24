const fs = require('fs');
const https = require('https');

const url = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/43/municipios';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        const cities = JSON.parse(data);
        const processedCities = cities.map(city => ({
            name: city.nome,
            slug: city.nome.toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, '-')
        }));
        
        fs.writeFileSync('c:/Projetos/landing/data/cities_rs.json', JSON.stringify(processedCities, null, 2));
        console.log(`Saved ${processedCities.length} cities.`);
    });
}).on('error', (err) => {
    console.error('Error: ' + err.message);
});
