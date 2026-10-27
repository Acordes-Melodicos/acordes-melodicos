(function () {
  var ENDPOINT = window.AC_ENDPOINT || '';
  var PASS_KEY = 'ac_stats_pass';
  var RANGE_KEY = 'ac_stats_range';
  var TZ = 'America/Bogota';
  var RANGES = { '1': 'hoy', '7': 'últimos 7 días', '30': 'últimos 30 días', 'all': 'todo el lanzamiento' };

  var state = { pass: '', days: '7', metric: 'signups', data: null };

  function $(id) { return document.getElementById(id); }
  function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  // Todo lo que viene de la base (fuentes, campañas) lo escribe un visitante: se escapa siempre.
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(v) { return (Number(v) || 0).toLocaleString('es'); }
  function ratio(a, b) { return b > 0 ? a / b * 100 : 0; }
  function pct(a, b) {
    var p = ratio(a, b);
    return (p % 1 === 0 ? p.toFixed(0) : p.toFixed(1)).replace('.', ',') + '%';
  }
  function chan(totals, key) {
    var t = (totals && totals[key]) || {};
    return { visits: t.visits || 0, visitors: t.visitors || 0, signups: t.signups || 0 };
  }

  function rpc() {
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'stats', password: state.pass, days: state.days === 'all' ? null : Number(state.days) })
    }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    });
  }

  function showGate(message) {
    $('st-app').hidden = true;
    $('st-gate').hidden = false;
    var box = $('st-gate-msg');
    box.textContent = message || '';
    box.hidden = !message;
    $('st-enter').disabled = false;
    $('st-pass').focus();
  }

  function showMsg(message) {
    var box = $('st-msg');
    box.textContent = message || '';
    box.hidden = !message;
  }

  function load(silent) {
    if (!silent) $('st-enter').disabled = true;
    return rpc().then(function (d) {
      if (d && d.error === 'auth') {
        try { sessionStorage.removeItem(PASS_KEY); } catch (e) {}
        state.pass = '';
        showGate('Contraseña incorrecta.');
        return;
      }
      if (d && d.error === 'rate') {
        showGate('Demasiados intentos. Espera 10 minutos e inténtalo de nuevo.');
        return;
      }
      if (d && d.error) {
        showGate('El panel no está configurado todavía (' + d.error + ').');
        return;
      }
      try { sessionStorage.setItem(PASS_KEY, state.pass); } catch (e) {}
      state.data = d;
      $('st-gate').hidden = true;
      $('st-app').hidden = false;
      showMsg('');
      render();
    }).catch(function () {
      if ($('st-app').hidden) showGate('No se pudo conectar. Inténtalo de nuevo en unos segundos.');
      else showMsg('No se pudieron actualizar los datos. Reintentando en el próximo ciclo.');
    });
  }

  /* ---------- Render ---------- */

  function render() {
    var d = state.data;
    var paid = chan(d.totals, 'paid');
    var org = chan(d.totals, 'organic');

    all('.ac-st-range').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-days') === state.days); });
    all('.ac-st-seg-btn').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-metric') === state.metric); });

    $('st-updated').textContent = 'Actualizado ' + new Date(d.generated_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

    renderSplit(paid, org);
    renderChannels(paid, org);
    renderChart(d.daily || []);
    renderSources(d.by_source || []);
    renderCampaigns(d.by_campaign || []);
    renderDevices(d.devices || []);
    renderRecent(d.recent || []);

    var u = d.untagged_meta || {};
    var note = $('st-untagged');
    if ((u.visits || 0) > 0) {
      note.textContent = u.visits + ' visita' + (u.visits === 1 ? '' : 's') + ' (' + (u.signups || 0) + ' registro' + (u.signups === 1 ? '' : 's') +
        ') llegaron desde Facebook o Instagram con fbclid pero sin la etiqueta de pago. Pueden ser anuncios sin etiquetar o publicaciones orgánicas; ' +
        'cuéntalas como pago solo si confirmas que son de un anuncio.';
      note.hidden = false;
    } else {
      note.hidden = true;
    }
  }

  function renderSplit(paid, org) {
    var total = paid.signups + org.signups;
    var wPaid = ratio(paid.signups, total);
    var wOrg = total ? 100 - wPaid : 0;
    $('st-split').innerHTML =
      '<div class="ac-st-total"><b class="ac-gold">' + num(total) + '</b><span>registros en la lista de espera &middot; ' + esc(RANGES[state.days]) + '</span></div>' +
      '<div class="ac-st-bar" role="img" aria-label="Reparto de registros entre pago y orgánico">' +
        '<i class="is-paid" style="width:' + wPaid + '%"></i><i class="is-org" style="width:' + wOrg + '%"></i></div>' +
      '<div class="ac-st-bar-legend">' +
        '<span><i class="ac-st-dot is-paid"></i><b>Pago</b> ' + num(paid.signups) + ' (' + pct(paid.signups, total) + ')</span>' +
        '<span><i class="ac-st-dot is-org"></i><b>Orgánico</b> ' + num(org.signups) + ' (' + pct(org.signups, total) + ')</span>' +
      '</div>' +
      (total ? '' : '<p class="ac-st-empty">Aún no hay registros en este rango.</p>');
  }

  function chanCard(cls, title, tag, t) {
    return '<article class="ac-st-glass ac-st-chan">' +
      '<header><h2>' + title + '</h2><span class="ac-st-tag ' + cls + '">' + tag + '</span></header>' +
      '<div class="ac-st-kpis">' +
        '<div class="ac-st-kpi"><b>' + num(t.visits) + '</b><span>Visitas</span></div>' +
        '<div class="ac-st-kpi"><b>' + num(t.signups) + '</b><span>Registros</span></div>' +
        '<div class="ac-st-kpi"><b>' + pct(t.signups, t.visits) + '</b><span>Conversión</span></div>' +
      '</div></article>';
  }

  function renderChannels(paid, org) {
    $('st-channels').innerHTML =
      chanCard('is-paid', 'Tráfico de pago', 'Meta Ads', paid) +
      chanCard('is-org', 'Tráfico orgánico', 'Sin anuncios', org);
  }

  function isoDay(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function dayMs(iso) { return Date.parse(iso + 'T00:00:00Z'); }
  function shortDay(iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7); }

  function renderChart(daily) {
    var today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
    var byDay = {};
    daily.forEach(function (r) { byDay[r.day] = r; });

    var start;
    if (state.days === 'all') {
      start = daily.length ? daily[0].day : today;
    } else {
      start = isoDay(dayMs(today) - (Number(state.days) - 1) * 86400000);
    }
    var days = [];
    for (var t = dayMs(start); t <= dayMs(today); t += 86400000) days.push(isoDay(t));
    if (!days.length) days = [today];

    var key = state.metric;
    var rows = days.map(function (day) {
      var r = byDay[day] || {};
      return { day: day, paid: r['paid_' + key] || 0, org: r['organic_' + key] || 0 };
    });

    var max = rows.reduce(function (m, r) { return Math.max(m, r.paid + r.org); }, 0);
    var steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    var step = steps[steps.length - 1];
    for (var s = 0; s < steps.length; s++) {
      if (max / steps[s] <= 4) { step = steps[s]; break; }
    }
    var top = Math.max(step * Math.ceil(Math.max(max, 1) / step), step);

    // Se dibuja al ancho real del contenedor para que los textos no se encojan en el celular
    var W = Math.max(280, $('st-chart').clientWidth || 720), H = W < 520 ? 210 : 250, L = 34, R = 6, T = 10, B = 28;
    var pw = W - L - R, ph = H - T - B;
    var slot = pw / rows.length;
    var bw = Math.max(2, Math.min(46, slot * 0.64));

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Evolución diaria de ' + (key === 'signups' ? 'registros' : 'visitas') + ' por canal">';
    for (var g = 0; g <= top; g += step) {
      var y = T + ph - ph * g / top;
      svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="rgba(255,255,255,0.09)"/>' +
             '<text class="ac-st-axis" x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + g + '</text>';
    }
    var every = Math.ceil(rows.length / Math.max(3, Math.floor(pw / 62)));
    rows.forEach(function (r, i) {
      var x = L + slot * i + (slot - bw) / 2;
      var hOrg = ph * r.org / top;
      var hPaid = ph * r.paid / top;
      var yOrg = T + ph - hOrg;
      var yPaid = yOrg - hPaid;
      svg += '<g><title>' + shortDay(r.day) + ' · Pago ' + r.paid + ' · Orgánico ' + r.org + '</title>';
      if (r.org) svg += '<rect x="' + x + '" y="' + yOrg + '" width="' + bw + '" height="' + hOrg + '" rx="3" fill="#3b8cff"/>';
      if (r.paid) svg += '<rect x="' + x + '" y="' + yPaid + '" width="' + bw + '" height="' + hPaid + '" rx="3" fill="#e3b04b"/>';
      svg += '<rect x="' + (L + slot * i) + '" y="' + T + '" width="' + slot + '" height="' + ph + '" fill="transparent"/></g>';
      if (i % every === 0 || i === rows.length - 1) {
        svg += '<text class="ac-st-axis" x="' + (x + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + shortDay(r.day) + '</text>';
      }
    });
    svg += '</svg>';
    $('st-chart').innerHTML = svg;
  }

  function renderSources(list) {
    if (!list.length) { $('st-sources').innerHTML = '<p class="ac-st-empty">Aún no hay visitas en este rango.</p>'; return; }
    var rows = list.map(function (r) {
      var cls = r.channel === 'paid' ? 'is-paid' : 'is-org';
      return '<tr><td><i class="ac-st-dot ' + cls + '"></i>' + esc(r.source) + '</td><td>' + num(r.visits) + '</td><td>' + num(r.signups) + '</td><td>' + pct(r.signups, r.visits) + '</td></tr>';
    }).join('');
    $('st-sources').innerHTML = '<table class="ac-st-table"><thead><tr><th>Fuente</th><th>Visitas</th><th>Registros</th><th>Conv.</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function renderCampaigns(list) {
    if (!list.length) {
      $('st-campaigns').innerHTML = '<p class="ac-st-empty">Todavía no llegan visitas de anuncios etiquetados. Mira abajo cómo etiquetarlos.</p>';
      return;
    }
    var rows = list.map(function (r) {
      return '<tr><td>' + esc(r.campaign) + (r.content ? '<small>' + esc(r.content) + '</small>' : '') + '</td><td>' + num(r.visits) + '</td><td>' + num(r.signups) + '</td><td>' + pct(r.signups, r.visits) + '</td></tr>';
    }).join('');
    $('st-campaigns').innerHTML = '<table class="ac-st-table"><thead><tr><th>Campaña / anuncio</th><th>Visitas</th><th>Registros</th><th>Conv.</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function renderDevices(list) {
    var totalVisits = list.reduce(function (s, r) { return s + r.visits; }, 0);
    if (!totalVisits) { $('st-devices').innerHTML = '<p class="ac-st-empty">Aún no hay visitas en este rango.</p>'; return; }
    var names = { mobile: 'Celular', desktop: 'Computador', desconocido: 'Otro' };
    var groups = {};
    list.forEach(function (r) {
      var g = groups[r.device] || (groups[r.device] = { visits: 0, signups: 0, paid: 0, org: 0 });
      g.visits += r.visits;
      g.signups += r.signups;
      if (r.channel === 'paid') g.paid += r.visits; else g.org += r.visits;
    });
    $('st-devices').innerHTML = Object.keys(groups).sort(function (a, b) { return groups[b].visits - groups[a].visits; }).map(function (k) {
      var g = groups[k];
      return '<div class="ac-st-dev"><div class="ac-st-dev-top"><b>' + esc(names[k] || k) + '</b><span>' + num(g.visits) + ' visitas &middot; ' + num(g.signups) + ' registros</span></div>' +
        '<div class="ac-st-bar"><i class="is-paid" style="width:' + ratio(g.paid, totalVisits) + '%"></i><i class="is-org" style="width:' + ratio(g.org, totalVisits) + '%"></i></div></div>';
    }).join('');
  }

  function renderRecent(list) {
    if (!list.length) { $('st-recent').innerHTML = '<p class="ac-st-empty">Aún no hay registros en este rango.</p>'; return; }
    $('st-recent').innerHTML = '<ul class="ac-st-recent">' + list.map(function (r) {
      var when = new Date(r.at).toLocaleString('es', { timeZone: TZ, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
      var cls = r.channel === 'paid' ? 'is-paid' : 'is-org';
      return '<li><time>' + esc(when) + '</time><span><i class="ac-st-dot ' + cls + '"></i>' + esc(r.source) + (r.campaign ? ' &middot; ' + esc(r.campaign) : '') + '</span></li>';
    }).join('') + '</ul>';
  }

  /* ---------- Eventos ---------- */

  $('st-login').addEventListener('submit', function (e) {
    e.preventDefault();
    var value = $('st-pass').value;
    if (!value) return;
    state.pass = value;
    $('st-gate-msg').hidden = true;
    load(false);
  });

  all('.ac-st-range').forEach(function (b) {
    b.addEventListener('click', function () {
      state.days = b.getAttribute('data-days');
      try { sessionStorage.setItem(RANGE_KEY, state.days); } catch (e) {}
      load(true);
    });
  });

  all('.ac-st-seg-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      state.metric = b.getAttribute('data-metric');
      render();
    });
  });

  $('st-refresh').addEventListener('click', function () { load(true); });

  $('st-logout').addEventListener('click', function () {
    try { sessionStorage.removeItem(PASS_KEY); } catch (e) {}
    state.pass = '';
    $('st-pass').value = '';
    showGate('');
  });

  all('.ac-st-copy').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = $(b.getAttribute('data-copy')).textContent;
      var done = function () { b.textContent = 'Copiado'; setTimeout(function () { b.textContent = 'Copiar'; }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, done);
      } else {
        done();
      }
    });
  });

  // Enlaces de ejemplo con el dominio real
  var base = location.origin + '/acordes';
  $('st-utm-1').textContent = base + '?utm_source=instagram&utm_medium=bio';
  $('st-utm-2').textContent = base + '?utm_source=whatsapp&utm_medium=grupo';
  $('st-utm-3').textContent = base + '?utm_source=email&utm_medium=newsletter';
  $('st-utm-off').textContent = base + '?notrack=1';

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (state.data && !$('st-app').hidden) renderChart(state.data.daily || []);
    }, 150);
  });

  // Actualización automática cada minuto mientras la pestaña está visible
  setInterval(function () {
    if (!document.hidden && state.pass && !$('st-app').hidden) load(true);
  }, 60000);

  try {
    var savedRange = sessionStorage.getItem(RANGE_KEY);
    if (savedRange && RANGES[savedRange]) state.days = savedRange;
    state.pass = sessionStorage.getItem(PASS_KEY) || '';
  } catch (e) {}

  if (!ENDPOINT) {
    $('st-login').querySelector('button').disabled = true;
    showGate('El panel todavía no está conectado a la hoja de cálculo. Falta pegar su dirección en ac-config.js.');
    $('st-enter').disabled = true;
  } else if (state.pass) {
    load(false);
  } else {
    $('st-pass').focus();
  }
})();
