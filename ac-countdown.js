(function () {
  // Gran lanzamiento: miércoles 11 de noviembre de 2026, 8:00 PM hora Colombia y Perú (UTC-5)
  var DEFAULT_PREFIX = 'Únete a la lista de espera de Acordes Melódicos';
  var target = Date.parse('2026-11-12T01:00:00Z');

  var els = {
    days: document.querySelectorAll('[data-ac="days"]'),
    hours: document.querySelectorAll('[data-ac="hours"]'),
    mins: document.querySelectorAll('[data-ac="mins"]'),
    secs: document.querySelectorAll('[data-ac="secs"]')
  };
  var bars = document.querySelectorAll('[data-ac-bar]');
  var locals = document.querySelectorAll('[data-ac-local]');

  function pad(n) { return String(n).padStart(2, '0'); }
  function setAll(list, value) {
    for (var i = 0; i < list.length; i++) list[i].textContent = value;
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function remaining(diff) {
    var days = Math.floor(diff / 86400000);
    var hours = Math.floor(diff / 3600000);
    var mins = Math.floor(diff / 60000);
    if (days >= 2) return 'Faltan ' + plural(days, 'día', 'días');
    if (hours >= 2) return 'Faltan ' + plural(hours, 'hora', 'horas');
    if (hours === 1) return 'Falta 1 hora';
    if (mins >= 2) return 'Faltan ' + plural(mins, 'minuto', 'minutos');
    if (mins === 1) return 'Falta 1 minuto';
    return 'Faltan segundos';
  }

  function barText(diff, prefix) {
    if (diff <= 0) return '¡El gran lanzamiento de Acordes Melódicos ya comenzó!';
    return prefix + ' · ' + remaining(diff) + ' para el gran lanzamiento';
  }

  function tick() {
    var diff = target - Date.now();
    var d = Math.max(0, diff);
    setAll(els.days, pad(Math.floor(d / 86400000)));
    setAll(els.hours, pad(Math.floor((d % 86400000) / 3600000)));
    setAll(els.mins, pad(Math.floor((d % 3600000) / 60000)));
    setAll(els.secs, pad(Math.floor((d % 60000) / 1000)));
    for (var i = 0; i < bars.length; i++) {
      bars[i].textContent = barText(diff, bars[i].getAttribute('data-prefix') || DEFAULT_PREFIX);
    }
  }

  try {
    var local = new Date(target).toLocaleString('es', {
      weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit'
    });
    setAll(locals, 'En tu zona horaria: ' + local);
  } catch (e) {}

  tick();
  setInterval(tick, 1000);
})();
