(function () {
  // Mide de dónde llega cada visita y cada registro (pago vs orgánico). No guarda correos.
  var ENDPOINT = window.AC_ENDPOINT || '';
  var ATTR_KEY = 'ac_attr';
  var VID_KEY = 'ac_vid';
  var SEEN_KEY = 'ac_seen';
  var OFF_KEY = 'ac_notrack';
  var TTL = 30 * 86400000;

  function read(store, key) {
    try { return JSON.parse(store.getItem(key)); } catch (e) { return null; }
  }
  function write(store, key, value) {
    try { store.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  var query = new URLSearchParams(location.search);

  // ?notrack=1 excluye este navegador de las estadísticas (equipo interno); ?notrack=0 lo vuelve a incluir.
  if (query.has('notrack')) write(localStorage, OFF_KEY, query.get('notrack') !== '0');
  var local = !location.hostname || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!ENDPOINT || read(localStorage, OFF_KEY) || local) {
    window.acTrack = function () {};
    return;
  }

  var PAID_MEDIUM = /^(cpc|ppc|paid|paid[-_ ]?social|paid[-_ ]?media|ads?|meta[-_ ]?ads?|pago)$/i;
  var PAID_SOURCE = /^(meta[-_ ]?ads?|facebook[-_ ]?ads?|fb[-_ ]?ads?|instagram[-_ ]?ads?|ig[-_ ]?ads?)$/i;

  var REFERRERS = [
    [/(^|\.)instagram\.com$/, 'instagram'],
    [/(^|\.)(facebook|fb)\.com$|^fb\.me$/, 'facebook'],
    [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
    [/(^|\.)tiktok\.com$/, 'tiktok'],
    [/(^|\.)(whatsapp\.com|wa\.me)$/, 'whatsapp'],
    [/(^|\.)google\./, 'google'],
    [/(^|\.)bing\.com$/, 'bing'],
    [/(^|\.)(twitter\.com|x\.com|t\.co)$/, 'x'],
    [/(^|\.)skool\.com$/, 'skool'],
    [/(^|\.)systeme\.io$/, 'systeme']
  ];

  function referrerHost() {
    try {
      if (!document.referrer) return '';
      var host = new URL(document.referrer).hostname.replace(/^www\./, '');
      return host === location.hostname ? '' : host;
    } catch (e) { return ''; }
  }

  function referrerName(host) {
    for (var i = 0; i < REFERRERS.length; i++) {
      if (REFERRERS[i][0].test(host)) return REFERRERS[i][1];
    }
    return host;
  }

  function compute() {
    var medium = query.get('utm_medium') || '';
    var utmSource = query.get('utm_source') || '';
    var host = referrerHost();
    var paid = PAID_MEDIUM.test(medium) || PAID_SOURCE.test(utmSource);
    return {
      channel: paid ? 'paid' : 'organic',
      source: (utmSource || (host ? referrerName(host) : '') || 'directo').toLowerCase(),
      medium: medium,
      campaign: query.get('utm_campaign') || '',
      content: query.get('utm_content') || '',
      ref: host,
      fb: query.has('fbclid'),
      ts: Date.now(),
      fresh: !!(utmSource || medium || query.get('utm_campaign') || query.has('fbclid') || host)
    };
  }

  // Una visita nueva con etiquetas o referido reemplaza la atribución guardada;
  // si vuelve directo, se mantiene la fuente original (hasta 30 días).
  var attr = compute();
  var saved = read(localStorage, ATTR_KEY);
  if (!attr.fresh && saved && Date.now() - saved.ts < TTL) {
    attr = saved;
  } else {
    delete attr.fresh;
    write(localStorage, ATTR_KEY, attr);
  }

  function visitorId() {
    var id = read(localStorage, VID_KEY);
    if (!id) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
      write(localStorage, VID_KEY, id);
    }
    return id;
  }

  function send(event) {
    var body = JSON.stringify({
      action: 'track',
      event: event,
      channel: attr.channel,
      source: attr.source,
      medium: attr.medium || '',
      campaign: attr.campaign || '',
      content: attr.content || '',
      referrer: attr.ref || '',
      fbclid: !!attr.fb,
      device: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      visitor: visitorId()
    });
    try {
      // text/plain evita la comprobación previa (CORS) y la petición sale igual aunque no se lea la respuesta
      fetch(ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: body,
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }

  window.acTrack = send;

  // Una visita por sesión del navegador (recargar no suma)
  try {
    if (!sessionStorage.getItem(SEEN_KEY)) {
      sessionStorage.setItem(SEEN_KEY, '1');
      send('visit');
    }
  } catch (e) { send('visit'); }
})();
