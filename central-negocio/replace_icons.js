const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/painel/cardapio-ia.html');
let content = fs.readFileSync(file, 'utf8');

// 1. Add Phosphor Icons Script
if (!content.includes('unpkg.com/@phosphor-icons/web')) {
    content = content.replace(
        '<link rel="stylesheet" href="/assets/css/global.css">',
        '<script src="https://unpkg.com/@phosphor-icons/web"></script>\n    <link rel="stylesheet" href="/assets/css/global.css">'
    );
}

// 2. Replace the ai-hero::after CSS block
content = content.replace(
    /\.ai-hero::after \{[\s\S]*?\}/,
    `.ai-hero-bg-icon {
            position: absolute;
            right: -20px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 180px;
            opacity: 0.08;
            color: #fff;
        }`
);

// 3. Insert the icon into the hero
if (!content.includes('ai-hero-bg-icon')) {
    content = content.replace(
        '<div class="ai-hero">',
        '<div class="ai-hero">\n                    <i class="ph-fill ph-robot ai-hero-bg-icon"></i>'
    );
}

// 4. Replacements map
const replacements = [
    ['<span class="nav-icon">⊞</span>', '<i class="ph ph-squares-four nav-icon" style="font-size: 18px"></i>'],
    ['<span class="nav-icon">🎓</span>', '<i class="ph ph-graduation-cap nav-icon" style="font-size: 18px"></i>'],
    ['<span class="nav-icon">🤖</span>', '<i class="ph ph-robot nav-icon" style="font-size: 18px"></i>'],
    ['<span class="nav-icon">🍽️</span>', '<i class="ph ph-fork-knife nav-icon" style="font-size: 18px"></i>'],
    ['<span class="nav-icon">✨</span>', '<i class="ph ph-sparkle nav-icon" style="font-size: 18px"></i>'],
    ['<span class="nav-icon">🎫</span>', '<i class="ph ph-ticket nav-icon" style="font-size: 18px"></i>'],
    ['<span class="nav-icon">📊</span>', '<i class="ph ph-chart-bar nav-icon" style="font-size: 18px"></i>'],
    ['↩ Sair', '<i class="ph ph-sign-out"></i> Sair'],
    ['✨ Powered by', '<i class="ph-fill ph-sparkle"></i> Powered by'],
    ['✨ Assistente de Cardápio com IA', '<i class="ph-fill ph-sparkle text-indigo-500"></i> Assistente de Cardápio com IA'],
    ['<h2>🍽️ Dados do Prato</h2>', '<h2 style="display:flex;align-items:center;gap:8px"><i class="ph-fill ph-cooking-pot text-indigo-500" style="font-size:20px"></i> Dados do Prato</h2>'],
    ['<div style="font-size:24px;margin-bottom:4px">📸</div>', '<div style="font-size:32px;margin-bottom:4px;color:#94a3b8"><i class="ph-fill ph-camera"></i></div>'],
    ['📝 Textos (Nome + Copy)', '<i class="ph-fill ph-text-aa text-indigo-500"></i> Textos (Nome + Copy)'],
    ['🎨 Imagem do prato com IA', '<i class="ph-fill ph-image text-indigo-500"></i> Imagem do prato com IA'],
    ['✨ Gerar com IA', '<i class="ph-fill ph-magic-wand"></i> Gerar com IA'],
    ['<span style="font-size:20px">✨</span>', '<i class="ph-fill ph-sparkle" style="font-size:22px"></i>'],
    ['<label>📛 Nome sugerido para o cardápio</label>', '<label style="display:flex;align-items:center;gap:6px"><i class="ph-fill ph-tag"></i> Nome sugerido para o cardápio</label>'],
    ['<label>📝 Descrição completa (para o app)</label>', '<label style="display:flex;align-items:center;gap:6px"><i class="ph-fill ph-text-align-left"></i> Descrição completa (para o app)</label>'],
    ['<label>⚡ Descrição curta (lista do cardápio)</label>', '<label style="display:flex;align-items:center;gap:6px"><i class="ph-fill ph-lightning"></i> Descrição curta (lista do cardápio)</label>'],
    ['<label>🎨 Prompt de imagem — cole no ChatGPT, Midjourney ou DALL-E</label>', '<label style="display:flex;align-items:center;gap:6px"><i class="ph-fill ph-palette"></i> Prompt de imagem — cole no ChatGPT, Midjourney ou DALL-E</label>'],
    ['✨ Gerar Imagem', '<i class="ph-fill ph-image"></i> Gerar Imagem'],
    ['🟢 Abrir ChatGPT', '<i class="ph-fill ph-chat-circle"></i> Abrir ChatGPT'],
    ['🔵 Bing Image Creator', '<i class="ph-fill ph-microsoft-logo"></i> Bing Image Creator'],
    ['📥 Baixar Imagem Original', '<i class="ph-bold ph-download-simple"></i> Baixar Imagem Original'],
    ['<label>💡 Dicas da IA para você</label>', '<label style="display:flex;align-items:center;gap:6px"><i class="ph-fill ph-lightbulb"></i> Dicas da IA para você</label>'],
    ['🔄 Gerar variação alternativa', '<i class="ph-bold ph-arrows-clockwise"></i> Gerar variação alternativa'],
    ['<h2>📚 Boas práticas de cardápio</h2>', '<h2 style="font-size:14px;display:flex;align-items:center;gap:6px"><i class="ph-fill ph-books" style="color:#6366f1;font-size:18px"></i> Boas práticas de cardápio</h2>'],
    ['<span>🌟</span>', '<i class="ph-fill ph-star" style="color:#f59e0b;font-size:16px;margin-top:2px"></i>'],
    ['<span>🍫</span>', '<i class="ph-fill ph-cookie" style="color:#8b5cf6;font-size:16px;margin-top:2px"></i>'],
    ['<span>📏</span>', '<i class="ph-fill ph-ruler" style="color:#ef4444;font-size:16px;margin-top:2px"></i>'],
    ['<span>📸</span>', '<i class="ph-fill ph-camera" style="color:#10b981;font-size:16px;margin-top:2px"></i>'],
    ['<span>💰</span>', '<i class="ph-fill ph-money" style="color:#14b8a6;font-size:16px;margin-top:2px"></i>'],
    ['<div style="font-size:22px;margin-bottom:8px">🎨</div>', '<div style="font-size:28px;margin-bottom:8px;color:#c4b5fd"><i class="ph-fill ph-palette"></i></div>'],
    ['🖼️ Abrir Bing Image Creator', '<i class="ph-bold ph-arrow-square-out"></i> Abrir Bing Image Creator'],
    ['<h2>🕐 Últimas gerações</h2>', '<h2 style="font-size:14px;margin-bottom:12px;display:flex;align-items:center;gap:6px"><i class="ph-fill ph-clock-counter-clockwise" style="color:#6366f1;font-size:18px"></i> Últimas gerações</h2>']
];

let changedCount = 0;
for (const [emojiStr, iconHtml] of replacements) {
    // some might appear multiple times or just once, we use split join for all instances
    if (content.includes(emojiStr)) {
        content = content.split(emojiStr).join(iconHtml);
        changedCount++;
    } else {
        // try without exact match just replacing emojis via regex if minor differences
        // console.log("Did not find: ", emojiStr);
    }
}

console.log(`Replaced ${changedCount} items.`);

// Extra regex fixes for topbar and sidebar toggle
content = content.replace('☰', '<i class="ph ph-list"></i>');

fs.writeFileSync(file, content, 'utf8');
console.log("Done updating cardapio-ia.html");
