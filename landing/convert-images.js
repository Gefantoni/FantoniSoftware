/**
 * Converte todas as imagens PNG da pasta Clientes para WebP
 * e também converte imagens grandes do diretório assets.
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const clientesDir = 'assets/Clientes';
const assetsDir = 'assets';

async function convertToWebp(inputPath, outputPath, options = {}) {
  const { width, quality } = { width: null, quality: 80, ...options };
  let pipeline = sharp(inputPath);
  if (width) pipeline = pipeline.resize(width);
  await pipeline.webp({ quality }).toFile(outputPath);
  
  const inputSize = fs.statSync(inputPath).size;
  const outputSize = fs.statSync(outputPath).size;
  const saved = ((1 - outputSize / inputSize) * 100).toFixed(1);
  console.log(`  ${path.basename(inputPath)} (${(inputSize/1024).toFixed(1)}KB) -> ${path.basename(outputPath)} (${(outputSize/1024).toFixed(1)}KB) [-${saved}%]`);
}

async function main() {
  // 1. Converter imagens dos clientes (68x68 no máximo, usar qualidade menor)
  console.log('\n=== Convertendo imagens de Clientes ===');
  const clientFiles = fs.readdirSync(clientesDir).filter(f => f.endsWith('.png'));
  for (const file of clientFiles) {
    const input = path.join(clientesDir, file);
    const output = path.join(clientesDir, file.replace('.png', '.webp'));
    if (fs.existsSync(output)) {
      console.log(`  [SKIP] ${output} já existe`);
      continue;
    }
    await convertToWebp(input, output, { width: 136, quality: 75 }); // 2x for retina (68*2)
  }

  // 2. Converter imagens grandes dos assets que ainda são PNG
  console.log('\n=== Convertendo imagens de assets ===');
  const assetsToConvert = [
    { file: 'Gestão Completa (1).png', width: 800 },
    { file: 'NF.png', width: 600 },
    { file: 'Varejo image.png', width: 800 },
    { file: 'integração.png', width: 800 },
    { file: 'feed-vendas.png', width: 800 },
    { file: 'feedback-screenshot.png', width: 600 },
    { file: 'Cede.jpeg', width: 400 },
  ];
  
  for (const { file, width } of assetsToConvert) {
    const input = path.join(assetsDir, file);
    if (!fs.existsSync(input)) {
      console.log(`  [SKIP] ${file} não encontrado`);
      continue;
    }
    const ext = path.extname(file);
    const output = path.join(assetsDir, file.replace(ext, '.webp'));
    if (fs.existsSync(output)) {
      console.log(`  [SKIP] ${path.basename(output)} já existe`);
      continue;
    }
    await convertToWebp(input, output, { width, quality: 80 });
  }
  
  // 3. Logo (precisa ser pequeno)
  console.log('\n=== Verificando logo ===');
  if (!fs.existsSync('assets/logo.webp')) {
    await convertToWebp('assets/logo.png', 'assets/logo.webp', { width: 200, quality: 80 });
  } else {
    console.log('  [SKIP] logo.webp já existe');
  }

  console.log('\n✓ Conversão concluída!');
}

main().catch(err => { console.error(err); process.exit(1); });
