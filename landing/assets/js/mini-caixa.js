/* Mini caixa da home: demonstração do Fantoni PDV que o visitante opera.
   Venda por grupos, edição do item (quantidade, complementos, observação, desconto),
   desconto na venda, pagamento parcial por itens, divisão da conta, troco no dinheiro
   e finalização rápida com nota fiscal. Sem biblioteca. Monta em [data-mini-caixa]. */
(function () {
  'use strict';
  var root = document.querySelector('[data-mini-caixa]');
  if (!root) return;

  // ---------- Ícones dos produtos (desenho próprio, cores da marca) ----------
  var L = '#ff6a3d', LC = '#ff9f7a', LS = '#ffd3b5', V = '#12c9a8', R = '#2a1b5e', LI = '#d2cce6';
  var ICON = {
    burger: '<path d="M8 21c0-8 7-13 16-13s16 5 16 13z" fill="' + LC + '"/><circle cx="18" cy="14" r="1.2" fill="#fff"/><circle cx="25" cy="12" r="1.2" fill="#fff"/><circle cx="31" cy="16" r="1.2" fill="#fff"/><rect x="6" y="23" width="36" height="4" rx="2" fill="' + V + '"/><rect x="7" y="28" width="34" height="6" rx="3" fill="' + R + '"/><path d="M8 36h32v2a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z" fill="' + LC + '"/>',
    hotdog: '<rect x="5" y="20" width="38" height="15" rx="7.5" fill="' + LC + '"/><rect x="3" y="22" width="42" height="7" rx="3.5" fill="' + L + '"/><path d="M9 25.5l4-2 4 2 4-2 4 2 4-2 4 2 4-2" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    pizza: '<path d="M24 43 5 12a28 28 0 0 1 38 0z" fill="' + LS + '"/><path d="M5 12a28 28 0 0 1 38 0l-2.6 4.2a23 23 0 0 0-32.8 0z" fill="' + LC + '"/><circle cx="19" cy="21" r="3.2" fill="' + L + '"/><circle cx="29" cy="24" r="3.2" fill="' + L + '"/><circle cx="23" cy="32" r="2.8" fill="' + L + '"/>',
    fritas: '<rect x="14" y="9" width="4" height="18" rx="2" fill="' + LS + '"/><rect x="20" y="6" width="4" height="20" rx="2" fill="' + LS + '"/><rect x="26" y="8" width="4" height="19" rx="2" fill="' + LS + '"/><rect x="31" y="11" width="4" height="16" rx="2" fill="' + LS + '"/><path d="M11 22h26l-3 20H14z" fill="' + L + '"/><path d="M19 30h10" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
    aneis: '<circle cx="18" cy="27" r="9" fill="none" stroke="' + LC + '" stroke-width="5"/><circle cx="30" cy="21" r="9" fill="none" stroke="' + L + '" stroke-width="5"/>',
    chopp: '<path d="M33 18h4a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-4" stroke="' + LC + '" stroke-width="4" fill="none"/><rect x="10" y="12" width="23" height="30" rx="4" fill="' + LC + '"/><path d="M9 15a6 6 0 0 1 6-8h13a6 6 0 0 1 6 8z" fill="#fff" stroke="' + LI + '" stroke-width="1.5"/><path d="M16 20v16M22 20v16M28 20v16" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>',
    longneck: '<path d="M21 4h6v8l4 6v24a2 2 0 0 1-2 2H19a2 2 0 0 1-2-2V18l4-6z" fill="' + V + '"/><rect x="21" y="3" width="6" height="3" rx="1" fill="' + R + '"/><rect x="17" y="26" width="14" height="9" fill="#fff"/>',
    lata: '<rect x="14" y="8" width="20" height="34" rx="4" fill="' + L + '"/><rect x="15" y="5" width="18" height="5" rx="2.5" fill="' + LI + '"/><path d="M14 26c4-3 8 3 12 0s6-3 8 0" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
    agua: '<path d="M20 4h8v6l4 6v26a2 2 0 0 1-2 2H18a2 2 0 0 1-2-2V16l4-6z" fill="' + LI + '"/><rect x="20" y="2" width="8" height="4" rx="1.5" fill="' + V + '"/><path d="M17 28h14" stroke="#fff" stroke-width="2"/><path d="M24 31c-2 3-2 5 0 6 2-1 2-3 0-6z" fill="' + V + '"/>',
    suco: '<path d="M30 4 27 14" stroke="' + R + '" stroke-width="2.4" stroke-linecap="round"/><path d="M12 12h24l-3 30H15z" fill="' + LC + '"/><path d="M13.4 22h21.2" stroke="#fff" stroke-width="2" opacity=".7"/><circle cx="34" cy="13" r="5" fill="' + V + '"/>'
  };
  function svgIcon(k) { return '<svg viewBox="0 0 48 48" aria-hidden="true">' + ICON[k] + '</svg>'; }
  var I = {
    back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    bigcheck: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    dinheiro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>',
    cartao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg>',
    pix: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/><path d="M8.5 12 12 8.5 15.5 12 12 15.5z"/></svg>'
  };

  // ---------- Dados da demonstração ----------
  var PRODUTOS = [
    { id: 'burger', nome: 'Hambúrguer duplo', preco: 20, grupo: 'comidas', comps: [['Bacon', 4], ['Cheddar', 3], ['Ovo', 2], ['Cebola caramelizada', 2]] },
    { id: 'hotdog', nome: 'Cachorro-quente', preco: 14, grupo: 'comidas', comps: [['Bacon', 4], ['Purê', 2], ['Batata palha', 1]] },
    { id: 'pizza', nome: 'Pizza de calabresa', preco: 41, grupo: 'comidas', comps: [['Borda recheada', 8]] },
    { id: 'fritas', nome: 'Porção de fritas', preco: 15, grupo: 'comidas', comps: [['Cheddar e bacon', 6]] },
    { id: 'aneis', nome: 'Anéis de cebola', preco: 17, grupo: 'comidas', comps: [] },
    { id: 'chopp', nome: 'Chopp 300 ml', preco: 9, grupo: 'bebidas', comps: [] },
    { id: 'longneck', nome: 'Long neck', preco: 8, grupo: 'bebidas', comps: [] },
    { id: 'lata', nome: 'Refrigerante lata', preco: 6, grupo: 'bebidas', comps: [] },
    { id: 'agua', nome: 'Água sem gás', preco: 4, grupo: 'bebidas', comps: [] },
    { id: 'suco', nome: 'Suco natural', preco: 9, grupo: 'bebidas', comps: [['Com leite', 2]] }
  ];
  var byId = {}; PRODUTOS.forEach(function (p) { byId[p.id] = p; });

  var S = {
    grupos: [{ id: 'geral', nome: 'Geral' }, { id: 'bebidas', nome: 'Bebidas' }, { id: 'comidas', nome: 'Comidas' }],
    grupo: 'geral', criandoGrupo: false,
    cart: [], seq: 0, descVenda: null,
    view: 'venda', sheet: null,
    pay: null, finalTxt: null, interagiu: false
  };

  // ---------- Contas ----------
  var BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function brl(v) { return '<span class="mc-money">' + BRL.format(Math.round(v * 100) / 100) + '</span>'; }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function unit(it) { var p = byId[it.pid]; return p.preco + it.comps.reduce(function (s, n) { return s + compPreco(p, n); }, 0); }
  function compPreco(p, n) { for (var i = 0; i < p.comps.length; i++) if (p.comps[i][0] === n) return p.comps[i][1]; return 0; }
  function bruto(it) { return unit(it) * it.qtd; }
  function descValor(d, base) { if (!d) return 0; return Math.min(base, d.tipo === 'pct' ? base * d.v / 100 : d.v); }
  function liquido(it) { var b = bruto(it); return b - descValor(it.desc, b); }
  function subtotal(lista) { return (lista || S.cart).reduce(function (s, it) { return s + liquido(it); }, 0); }
  function descVendaValor() { return descValor(S.descVenda, subtotal()); }
  function total() { return subtotal() - descVendaValor(); }
  function qtdProduto(pid) { return S.cart.reduce(function (s, it) { return s + (it.pid === pid ? it.qtd : 0); }, 0); }
  function item(uid) { for (var i = 0; i < S.cart.length; i++) if (S.cart[i].uid === uid) return S.cart[i]; return null; }
  function descTxt(d) { return d.tipo === 'pct' ? d.v + '%' : BRL.format(d.v); }

  // Valor a pagar agora: itens marcados, com a parte proporcional do desconto da venda.
  function alvo() {
    var sel = S.cart.filter(function (it) { return S.pay.sel[it.uid]; });
    var sub = subtotal(sel), all = subtotal();
    var d = all > 0 ? descVendaValor() * (sub / all) : 0;
    return Math.round((sub - d) * 100) / 100;
  }
  function pago() { return S.pay.pgtos.reduce(function (s, p) { return s + p.valor; }, 0); }
  function restante() { return Math.max(0, Math.round((alvo() - pago()) * 100) / 100); }
  function troco() { return Math.max(0, Math.round((pago() - alvo()) * 100) / 100); }
  function sugestao() { var r = restante(), parte = alvo() / S.pay.pessoas; return Math.round(Math.min(r, parte) * 100) / 100; }

  function track(acao) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'demo_caixa', demo_acao: acao });
  }
  function interagiu() { if (!S.interagiu) { S.interagiu = true; track('primeira_interacao'); } }

  // ---------- Telas ----------
  function render() {
    var h = '';
    if (S.view === 'venda') h = telaVenda();
    else if (S.view === 'pagamento') h = telaPagamento();
    else h = telaFinal();
    if (S.sheet) h += folha();
    root.innerHTML = h;
    var foco = root.querySelector('[data-autofocus]');
    if (foco) foco.focus();
  }

  function topo(titulo, voltar) {
    return '<div class="mc-top">' +
      (voltar ? '<button class="mc-top-back" data-act="voltar" aria-label="Voltar para a venda">' + I.back + '</button>' : '') +
      '<span class="mc-top-title">' + titulo + '</span><span class="mc-demo">Demonstração</span></div>';
  }

  function telaVenda() {
    var chips = S.grupos.map(function (g) {
      return '<button class="mc-chip' + (g.id === S.grupo ? ' is-on' : '') + '" data-act="grupo" data-id="' + g.id + '">' + esc(g.nome) + '</button>';
    }).join('');
    chips += S.criandoGrupo
      ? '<form class="mc-newgroup" data-form="grupo"><input name="nome" maxlength="18" placeholder="Nome do grupo" aria-label="Nome do novo grupo" data-autofocus><button type="submit">Criar</button></form>'
      : '<button class="mc-chip mc-chip-add" data-act="novo-grupo">+ Adicionar grupo</button>';

    var lista = PRODUTOS.filter(function (p) { return S.grupo === 'geral' || p.grupo === S.grupo; });
    var grid = lista.length ? lista.map(function (p) {
      var q = qtdProduto(p.id);
      return '<button class="mc-prod" data-act="add" data-id="' + p.id + '" aria-label="Adicionar ' + p.nome + '">' +
        (q ? '<span class="mc-badge">' + q + '</span>' : '') + svgIcon(p.id) +
        '<span class="mc-prod-nome">' + p.nome + '</span><span class="mc-prod-preco">' + brl(p.preco) + '</span></button>';
    }).join('') : '<div class="mc-empty-group">Grupo criado. No sistema você cadastra os produtos dele em segundos, inclusive pelo código de barras.</div>';

    var itens = S.cart.length ? S.cart.map(linhaItem).join('') : '<div class="mc-noitems">Nenhum item adicionado</div>';
    var desc = descVendaValor();
    return topo('Caixa 01 · Mesa 7', false) +
      '<div class="mc-body"><div class="mc-left"><div class="mc-groups">' + chips + '</div>' +
      (S.interagiu ? '' : '<div class="mc-hint">Toque nos produtos para lançar a venda</div>') +
      '<div class="mc-grid">' + grid + '</div></div>' +
      '<div class="mc-right"><div class="mc-right-title">Itens vendidos</div><div class="mc-items">' + itens + '</div>' +
      '<div class="mc-totais"><div class="mc-linha"><span>Subtotal</span>' + brl(subtotal()) + '</div>' +
      '<div class="mc-linha"><button data-act="desc-venda">Desconto na venda</button><span>' + (desc ? '− ' : '') + brl(desc) + '</span></div>' +
      '<div class="mc-linha mc-total"><span>Total</span>' + brl(total()) + '</div></div>' +
      '<button class="mc-cta mc-cta-pagar" data-act="pagar"' + (S.cart.length ? '' : ' disabled') + '>Pagamento</button></div></div>';
  }

  function detalhes(it) {
    var p = byId[it.pid], d = it.qtd + ' UN × ' + BRL.format(p.preco);
    it.comps.forEach(function (n) { d += '<br>+ ' + esc(n) + ' ' + BRL.format(compPreco(p, n)); });
    if (it.obs) d += '<br>Obs: ' + esc(it.obs);
    if (it.desc) d += '<br><span class="mc-desc">Desconto ' + descTxt(it.desc) + '</span>';
    return d;
  }
  function linhaItem(it) {
    return '<button class="mc-item" data-act="item" data-uid="' + it.uid + '" aria-label="Editar ' + byId[it.pid].nome + '">' +
      '<span class="mc-item-nome">' + byId[it.pid].nome + '</span><span class="mc-item-total">' + brl(liquido(it)) + '</span>' +
      '<span class="mc-item-det">' + detalhes(it) + '</span></button>';
  }

  function telaPagamento() {
    var P = S.pay;
    var itens = S.cart.map(function (it) {
      var on = !!P.sel[it.uid];
      return '<button class="mc-check' + (on ? ' is-on' : '') + '" data-act="sel" data-uid="' + it.uid + '" aria-pressed="' + on + '">' +
        '<span class="mc-box">' + (on ? I.check : '') + '</span>' +
        '<span><span class="mc-item-nome">' + byId[it.pid].nome + '</span><span class="mc-item-det" style="display:block">' + detalhes(it) + '</span></span>' +
        '<span class="mc-item-total">' + brl(liquido(it)) + '</span></button>';
    }).join('');
    var marcados = S.cart.filter(function (it) { return P.sel[it.uid]; }).length;

    var pg = P.pgtos.map(function (p, i) {
      return '<div class="mc-pgto"><span class="mc-pgto-nome">' + p.metodo + '</span>' + brl(p.valor) +
        '<button data-act="rm-pgto" data-i="' + i + '" aria-label="Remover pagamento">−</button></div>';
    }).join('') || '<div class="mc-note" style="padding:6px 2px">Escolha a forma de pagamento abaixo.</div>';

    var cash = '';
    if (P.dinheiro) {
      var r = restante();
      var notas = [r, Math.ceil(r / 10) * 10, Math.ceil(r / 50) * 50, 100].filter(function (v, i, a) { return v > 0 && a.indexOf(v) === i; });
      cash = '<div class="mc-cash"><div class="mc-cash-q">Quanto o cliente entregou em dinheiro?</div><div class="mc-cash-row">' +
        notas.map(function (v) { return '<button data-act="cash" data-v="' + v + '">' + (v === r ? 'Valor exato' : BRL.format(v)) + '</button>'; }).join('') +
        '</div><form class="mc-cash-in" data-form="cash"><input name="v" inputmode="decimal" placeholder="Outro valor" aria-label="Outro valor em dinheiro"><button type="submit">OK</button></form></div>';
    }

    var t = troco(), falta = restante();
    var podeFinalizar = marcados > 0 && falta === 0 && alvo() > 0;
    return topo('Pagamento', true) +
      '<div class="mc-pay"><div class="mc-pay-col"><div class="mc-sec">Itens a pagar<small>Desmarque para pagar só uma parte</small></div>' +
      '<div class="mc-paylist">' + itens + '</div>' +
      '<div class="mc-split"><span>Dividir conta</span><span class="mc-step"><button data-act="pessoas" data-d="-1" aria-label="Menos pessoas">−</button><span>' + P.pessoas + '</span><button data-act="pessoas" data-d="1" aria-label="Mais pessoas">+</button></span>' +
      '<span class="mc-split-val">' + (P.pessoas > 1 ? brl(alvo() / P.pessoas) + ' cada' : '1 pessoa') + '</span></div></div>' +
      '<div class="mc-pay-col"><div class="mc-sec">Formas de pagamento</div>' +
      '<div class="mc-methods"><button class="mc-method" data-act="metodo" data-m="Dinheiro">' + I.dinheiro + 'Dinheiro</button>' +
      '<button class="mc-method" data-act="metodo" data-m="Cartão">' + I.cartao + 'Cartão</button>' +
      '<button class="mc-method" data-act="metodo" data-m="Pix">' + I.pix + 'Pix</button></div>' + cash +
      '<div class="mc-pgtos">' + pg + '</div>' +
      '<div class="mc-totais"><div class="mc-linha"><span>A pagar agora</span>' + brl(alvo()) + '</div>' +
      '<div class="mc-linha"><span>Total pago</span>' + brl(pago()) + '</div>' +
      (t > 0 ? '<div class="mc-linha mc-troco"><span>Troco</span>' + brl(t) + '</div>'
             : '<div class="mc-linha mc-falta"><span>Falta</span>' + brl(falta) + '</div>') + '</div>' +
      '<button class="mc-cta mc-cta-fim" data-act="finalizar"' + (podeFinalizar ? '' : ' disabled') + '>Finalizar venda</button></div></div>';
  }

  function telaFinal() {
    var f = S.finalTxt;
    if (f.etapa < 2) {
      return topo('Pagamento', false) + '<div class="mc-final" role="status" aria-live="polite"><div class="mc-spin"></div>' +
        '<div class="mc-step-txt">' + (f.etapa === 0 ? 'Finalizando negociação…' : 'Imprimindo nota fiscal…') + '</div>' +
        '<div class="mc-steps"><span class="' + (f.etapa > 0 ? 'is-done' : '') + '">' + (f.etapa > 0 ? '✓ ' : '') + 'Venda registrada</span>' +
        '<span>NFC-e enviada para a SEFAZ</span></div></div>';
    }
    return topo('Venda concluída', false) + '<div class="mc-final" role="status" aria-live="polite"><div class="mc-ok">' + I.bigcheck + '</div>' +
      '<h3>Venda concluída</h3><div class="mc-final-det">' + brl(f.valor) + ' recebidos · NFC-e emitida' +
      (f.troco > 0 ? '<br>Troco: <strong>' + BRL.format(f.troco) + '</strong>' : '') +
      (f.restam ? '<br>Ainda ' + (f.restam === 1 ? 'falta 1 item' : 'faltam ' + f.restam + ' itens') + ' nesta mesa' : '') + '</div>' +
      '<div class="mc-final-det">Viu como é rápido? No seu caixa é assim todo dia.</div>' +
      '<div class="mc-final-actions"><button class="mc-cta mc-cta-pagar" data-act="cta-teste">Testar 7 dias grátis</button>' +
      '<button class="mc-cta mc-cta-sec" data-act="nova">' + (f.restam ? 'Voltar para a mesa' : 'Nova venda') + '</button></div></div>';
  }

  // ---------- Folha de edição ----------
  function folha() {
    var sh = S.sheet, corpo = '', titulo = '';
    if (sh.tipo === 'desc-venda' || sh.modo === 'desc') {
      var atual = sh.tipo === 'desc-venda' ? S.descVenda : item(sh.uid).desc;
      titulo = sh.tipo === 'desc-venda' ? 'Desconto na venda' : 'Desconto no item';
      var ops = [['pct', 5], ['pct', 10], ['pct', 15], ['valor', 2], ['valor', 5]];
      corpo = '<div class="mc-opts-row">' + ops.map(function (o) {
        var on = atual && atual.tipo === o[0] && atual.v === o[1];
        return '<button class="' + (on ? 'is-on' : '') + '" data-act="aplicar-desc" data-t="' + o[0] + '" data-v="' + o[1] + '">' + (o[0] === 'pct' ? o[1] + '%' : BRL.format(o[1])) + '</button>';
      }).join('') + '<button data-act="aplicar-desc" data-t="" data-v="0">Sem desconto</button></div>';
    } else {
      var it = item(sh.uid), p = byId[it.pid];
      titulo = p.nome;
      if (sh.modo === 'menu') {
        corpo = '<button class="mc-opt" data-act="modo" data-m="qtd">Quantidade</button>' +
          '<button class="mc-opt" data-act="modo" data-m="comps">Complementos</button>' +
          '<button class="mc-opt" data-act="modo" data-m="obs">Observação</button>' +
          '<button class="mc-opt" data-act="modo" data-m="desc">Desconto</button>' +
          '<button class="mc-opt is-danger" data-act="deletar">Deletar item</button>';
      } else if (sh.modo === 'qtd') {
        corpo = '<div class="mc-qty"><button data-act="qtd" data-d="-1" aria-label="Diminuir">−</button><span>' + it.qtd + '</span><button data-act="qtd" data-d="1" aria-label="Aumentar">+</button></div>' +
          '<button class="mc-cta mc-cta-fim" data-act="fechar">Pronto</button>';
      } else if (sh.modo === 'comps') {
        corpo = p.comps.length ? p.comps.map(function (c) {
          var on = it.comps.indexOf(c[0]) > -1;
          return '<button class="mc-comp' + (on ? ' is-on' : '') + '" data-act="comp" data-n="' + c[0] + '" aria-pressed="' + on + '"><span class="mc-box">' + (on ? I.check : '') + '</span>' + c[0] + brl(c[1]) + '</button>';
        }).join('') + '<button class="mc-cta mc-cta-fim" data-act="fechar">Pronto</button>'
          : '<div class="mc-note">Este produto não tem complementos. No sistema você cria os seus, como bacon, borda recheada ou ponto da carne.</div>';
      } else if (sh.modo === 'obs') {
        corpo = '<form data-form="obs"><textarea name="obs" maxlength="60" placeholder="Ex.: sem cebola, bem passado" aria-label="Observação do item" data-autofocus>' + esc(it.obs) + '</textarea>' +
          '<button class="mc-cta mc-cta-fim" type="submit">Salvar observação</button></form>';
      }
    }
    var anim = S.sheetNovo ? ' mc-anim' : '';
    S.sheetNovo = false;
    return '<div class="mc-sheet-bg' + anim + '" data-act="fechar-bg"><div class="mc-sheet' + anim + '" role="dialog" aria-modal="true" aria-label="' + esc(titulo) + '">' +
      '<div class="mc-sheet-head"><strong>' + esc(titulo) + '</strong><button data-act="fechar" aria-label="Fechar">×</button></div>' + corpo + '</div></div>';
  }

  // ---------- Ações ----------
  function finalizar() {
    var valor = alvo(), t = troco();
    var pagos = S.cart.filter(function (it) { return S.pay.sel[it.uid]; });
    var parcial = pagos.length < S.cart.length;
    S.finalTxt = { etapa: 0, valor: valor, troco: t, restam: 0 };
    S.view = 'final'; render();
    track('finalizar');
    setTimeout(function () { S.finalTxt.etapa = 1; render(); }, 550);
    setTimeout(function () {
      S.cart = S.cart.filter(function (it) { return !S.pay.sel[it.uid]; });
      if (!S.cart.length) S.descVenda = null;
      S.finalTxt.etapa = 2; S.finalTxt.restam = S.cart.reduce(function (s, it) { return s + it.qtd; }, 0);
      S.pay = null; render(); track(parcial ? 'venda_parcial_concluida' : 'venda_concluida');
    }, 1250);
  }

  function abrirPagamento() {
    var sel = {}; S.cart.forEach(function (it) { sel[it.uid] = true; });
    S.pay = { sel: sel, pessoas: 1, pgtos: [], dinheiro: false };
    S.view = 'pagamento'; track('abrir_pagamento');
  }

  function addPgto(metodo, valor) {
    valor = Math.round(valor * 100) / 100;
    if (valor <= 0) return;
    S.pay.pgtos.push({ metodo: metodo, valor: valor });
    S.pay.dinheiro = false;
  }

  root.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    var a = el.getAttribute('data-act');
    if (a === 'fechar-bg' && e.target !== el) return;
    interagiu();
    var tinhaFolha = !!S.sheet;
    switch (a) {
      case 'grupo': S.grupo = el.dataset.id; S.criandoGrupo = false; break;
      case 'novo-grupo': S.criandoGrupo = true; break;
      case 'add':
        var pid = el.dataset.id, ex = null;
        S.cart.forEach(function (it) { if (it.pid === pid && !it.comps.length && !it.obs && !it.desc) ex = it; });
        if (ex) ex.qtd++; else S.cart.push({ uid: ++S.seq, pid: pid, qtd: 1, comps: [], obs: '', desc: null });
        break;
      case 'item': S.sheet = { tipo: 'item', uid: +el.dataset.uid, modo: 'menu' }; break;
      case 'modo': S.sheet.modo = el.dataset.m; break;
      case 'qtd':
        var it = item(S.sheet.uid); it.qtd = Math.max(1, Math.min(99, it.qtd + (+el.dataset.d))); break;
      case 'comp':
        var ic = item(S.sheet.uid), n = el.dataset.n, k = ic.comps.indexOf(n);
        if (k > -1) ic.comps.splice(k, 1); else ic.comps.push(n);
        break;
      case 'aplicar-desc':
        var d = el.dataset.t ? { tipo: el.dataset.t, v: +el.dataset.v } : null;
        if (S.sheet.tipo === 'desc-venda') S.descVenda = d; else item(S.sheet.uid).desc = d;
        S.sheet = null; break;
      case 'deletar':
        S.cart = S.cart.filter(function (x) { return x.uid !== S.sheet.uid; }); S.sheet = null;
        if (!S.cart.length) S.descVenda = null;
        break;
      case 'desc-venda': if (S.cart.length) S.sheet = { tipo: 'desc-venda' }; break;
      case 'fechar': case 'fechar-bg': S.sheet = null; break;
      case 'pagar': if (S.cart.length) abrirPagamento(); break;
      case 'voltar': S.view = 'venda'; S.pay = null; break;
      case 'sel':
        var u = +el.dataset.uid; S.pay.sel[u] = !S.pay.sel[u]; S.pay.pgtos = []; S.pay.dinheiro = false; break;
      case 'pessoas': S.pay.pessoas = Math.max(1, Math.min(8, S.pay.pessoas + (+el.dataset.d))); break;
      case 'metodo':
        if (restante() <= 0) break;
        if (el.dataset.m === 'Dinheiro') S.pay.dinheiro = !S.pay.dinheiro;
        else addPgto(el.dataset.m, sugestao());
        break;
      case 'cash': addPgto('Dinheiro', +el.dataset.v); break;
      case 'rm-pgto': S.pay.pgtos.splice(+el.dataset.i, 1); break;
      case 'finalizar': if (restante() === 0 && alvo() > 0) { finalizar(); return; } break;
      case 'nova': S.view = 'venda'; S.finalTxt = null; break;
      case 'cta-teste':
        track('cta_teste');
        if (typeof window.openLeadModal === 'function') window.openLeadModal();
        return;
    }
    if (!tinhaFolha && S.sheet) S.sheetNovo = true;
    render();
  });

  root.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, tipo = f.getAttribute('data-form');
    if (tipo === 'grupo') {
      var nome = (f.nome.value || '').trim();
      if (nome) { var id = 'g' + (++S.seq); S.grupos.push({ id: id, nome: nome }); S.grupo = id; track('criar_grupo'); }
      S.criandoGrupo = false;
    } else if (tipo === 'obs') {
      item(S.sheet.uid).obs = f.obs.value.trim(); S.sheet = null;
    } else if (tipo === 'cash') {
      var v = parseFloat(String(f.v.value).replace(/\./g, '').replace(',', '.'));
      if (v > 0) addPgto('Dinheiro', v);
    }
    render();
  });

  root.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && S.sheet) { S.sheet = null; render(); }
  });

  render();
})();

// Esconde o botão flutuante enquanto o hero (com o caixa) está na tela.
(function () {
  var hero = document.getElementById('inicio');
  if (!hero) return;
  function checar() {
    document.body.classList.toggle('hero-visivel', hero.getBoundingClientRect().bottom > 160);
  }
  window.addEventListener('scroll', checar, { passive: true });
  window.addEventListener('resize', checar);
  checar();
})();
