/* Peçko sadakat akış provası — ortak durum ve metinler.
   Durum tarayıcıda (localStorage) tutulur, böylece sohbet → onay → puan → kasa
   sayfaları arasında gidip gelindiğinde akış kaldığı yerden sürer. */
(function (w) {
  'use strict';

  var KEY = 'pecko.sadakat.prova.v1';
  var P = {};

  P.BUSINESS = 'Peçko Fırın';     // sitedeki ticari ad
  P.REWARD = { name: '1 adet hediye kahve', cost: 10 };          // öntanımlı katalog
  P.activeRewards = function (s) {
    var list = (s && s.rewards && s.rewards.length) ? s.rewards : [{ id: 1, ad: P.REWARD.name, bedel: P.REWARD.cost, aktif: true }];
    return list.filter(function (r) { return r.aktif; }).sort(function (a, b) { return a.bedel - b.bedel; });
  };
  P.affordable = function (s) { return P.activeRewards(s).filter(function (r) { return s.stamps >= r.bedel; }); };
  P.nextReward = function (s) {
    var list = P.activeRewards(s);
    for (var i = 0; i < list.length; i++) if (list[i].bedel > s.stamps) return list[i];
    return null;
  };
  P.IG = { handle: '@peckofirin', story: 1, post: 2, max: 2, win: 60 };
  P.LEGAL_VERSION = '1.3';
  P.KVKK_URL = 'https://peckofirin.com.tr/sadakat/kvkk';
  P.PREFILL = function (token) { return 'Merhaba! Sadakat programına katılmak istiyorum. #' + token; };

  var HINT = 'Puanlarınızı ve alabileceğiniz ödülleri aşağıdaki düğmeden görebilirsiniz; istediğiniz zaman PUANIM yazarak bu sayfaya yeniden ulaşabilirsiniz.';
  var CMDS = 'Komutlar: KODUM · PUANIM · INSTAGRAM · VERILERIM · KAMPANYA · DUR · SIL · YARDIM';

  /* --- üye kodu: gerçek 31 sembollü alfabe + ağırlıklı kontrol karakteri --- */
  var ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  P.checkChar = function (body) {
    var sum = 0;
    for (var i = 0; i < body.length; i++) sum += ALPHABET.indexOf(body[i]) * (i + 2);
    return ALPHABET[sum % ALPHABET.length];
  };
  P.newCode = function () {
    var b = '', i, r = new Uint32Array(6);
    if (w.crypto && w.crypto.getRandomValues) w.crypto.getRandomValues(r);
    else for (i = 0; i < 6; i++) r[i] = Math.floor(Math.random() * 4294967296);
    for (i = 0; i < 6; i++) b += ALPHABET[r[i] % ALPHABET.length];
    var full = b + P.checkChar(b);
    return 'PK-' + full.slice(0, 4) + '-' + full.slice(4);
  };
  // Kasada özensiz yazımı toparlar, kontrol karakteri tutmazsa null döner.
  P.normalizeCode = function (input) {
    if (input == null) return null;
    var s = String(input).toLocaleUpperCase('tr-TR').replace(/İ/g, 'I').replace(/[^A-Z0-9]/g, '');
    if (s.indexOf('PK') === 0 && s.length === 9) s = s.slice(2);
    if (s.length !== 7) return null;
    var body = s.slice(0, 6);
    if (P.checkChar(body) !== s[6]) return null;
    return 'PK-' + s.slice(0, 4) + '-' + s.slice(4);
  };

  /* --- durum --- */
  function blank() {
    return {
      token: 'KASA1', code: null, status: 'none', stamps: 0, redeemed: 0,
      marketing: false, ig: null, log: [], events: [], pending: null,
      createdAt: null, activatedAt: null,
      rewards: null, staff: null, shift: null, audit: null, claims: null,
      campaigns: null, cards: null, iys: null, ornek: null
    };
  }
  // Depolama kapalı olabilir (gizli sekme, engellenmiş site verisi): sayfa yine çalışmalı.
  var memory = null;
  P.load = function () {
    try {
      var raw = w.localStorage.getItem(KEY);
      if (raw) return Object.assign(blank(), JSON.parse(raw));
    } catch (e) { /* yoksayılır */ }
    return memory ? Object.assign(blank(), memory) : blank();
  };
  P.save = function (s) {
    memory = s;
    try { w.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* yoksayılır */ }
    return s;
  };
  P.reset = function () {
    memory = null;
    try { w.localStorage.removeItem(KEY); } catch (e) { /* yoksayılır */ }
  };

  /* --- yardımcılar --- */
  P.now = function () {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  };
  P.today = function () { return new Date().toLocaleDateString('tr-TR'); };
  P.esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  // WhatsApp'ın *kalın* işaretlemesi.
  P.fmt = function (s) { return P.esc(s).replace(/\*([^*\n]+)\*/g, '<b>$1</b>'); };

  P.rewardLines = function (s) {
    var out = [], afford = P.affordable(s), next = P.nextReward(s);
    if (afford.length) {
      out.push('Şimdi alabileceğiniz ödüller: ' + afford.map(function (r) {
        return r.ad + ' (' + r.bedel + ' damga)';
      }).join(', ') + ' 🎁 Kasada kodunuzu söylemeniz yeterli.');
    }
    if (next) out.push('Sonraki ödül: ' + next.ad + ' – ' + (next.bedel - s.stamps) + ' damga kaldı.');
    return out.join('\n');
  };

  /* --- mesajlar: src/messages.js ile birebir --- */
  P.MSG = {
    welcome: function (s) {
      return 'Merhaba! ' + P.BUSINESS + ' sadakat programına hoş geldiniz. 🎂\n\n' +
        'Size ayrılan üyelik kodu: *' + s.code + '*\n\n' +
        'Kodunuzun aktif olması için KVKK aydınlatma metnini okuyup onay vermeniz gerekiyor. ' +
        'Onay bağlantısı 72 saat geçerlidir. Onay vermezseniz numaranız 72 saat içinde sistemimizden otomatik olarak silinir.';
    },
    consentReminder: function () {
      return 'Üyeliğiniz henüz onaylanmadı. Onay sayfası 72 saat geçerlidir; onay verdiğinizde kodunuz aktif olur.';
    },
    activated: function (s) {
      return 'Teşekkürler, üyeliğiniz aktif! ✅\n\n' + P.BUSINESS + ' üyelik kodunuz: *' + s.code + '*\n' +
        'Kasada bu kodu söylemeniz yeterli.\n\n' + HINT + '\n\n' + CMDS;
    },
    code: function (s) {
      return 'Üyelik kodunuz: *' + s.code + '*\nDamga: ' + s.stamps + '\n\n' + HINT + '\n\n' + CMDS;
    },
    points: function (s) {
      return 'Damga durumunuz: *' + s.stamps + '*\n' + P.rewardLines(s) +
        (s.redeemed ? '\nBugüne kadar kullandığınız ödül: ' + s.redeemed : '') +
        '\n\nTüm ödüller ve ayrıntılar için aşağıdaki düğmeye dokunun (bağlantı 7 gün geçerli). ' +
        'Instagram paylaşımıyla ek damga için INSTAGRAM yazın.';
    },
    instagram: function (s) {
      return '📸 *Instagram bonusu*\n\n' +
        (s.ig ? 'Kayıtlı Instagram hesabınız: *@' + s.ig + '* (değiştirmek için INSTAGRAM @yenihesap yazın)\n\n'
              : 'Instagram hesabınız henüz kayıtlı değil. Kaydetmek için *INSTAGRAM @kullaniciadi* yazın; böylece paylaşımlarınız otomatik eşleşir.\n\n') +
        "Instagram'da " + P.IG.handle + ' hesabımızı etiketleyerek bir *hikaye* paylaşın (hikaye paylaşamıyorsanız gönderi de olur). ' +
        (s.ig ? 'Hesabınız herkese açıksa paylaşımınız otomatik algılanır ve damganız eklenir. Hesabınız gizliyse veya birkaç dakika içinde mesaj gelmezse ekran görüntüsünü ' + P.IG.win + ' dakika içinde bu sohbete gönderin.'
              : 'Ardından paylaşımın ekran görüntüsünü ' + P.IG.win + ' dakika içinde bu sohbete gönderin; gönderi bağlantısını yapıştırmanız da yeterli.') +
        '\n\nHikaye +' + P.IG.story + ', gönderi +' + P.IG.post + ' damga (ayda en fazla ' + P.IG.max + ' paylaşım).';
    },
    data: function (s) {
      var t = (s.createdAt || P.today() + ' ' + P.now());
      var lines = [
        '📄 *Hakkınızda tuttuğumuz veriler* (KVKK m.11)', '',
        'Üyelik kodu: ' + s.code,
        'Telefon: +905321234567',
        'WhatsApp adı: Test Müşteri',
        'Instagram: ' + (s.ig ? '@' + s.ig : '—'),
        'Durum: ' + ({ pending: 'Onay bekliyor', active: 'Aktif', deleted: 'Silindi' }[s.status] || s.status),
        'Kayıt: ' + t + ' · Onay: ' + (s.activatedAt || '—') + ' · Son işlem: ' + P.today() + ' ' + P.now(),
        'Kayıt noktası: ' + s.token,
        'Damga: ' + s.stamps + ' · Kullanılan ödül: ' + s.redeemed,
        'Kampanya izni: ' + (s.marketing ? 'Var' : 'Yok'), '',
        '*Rıza kayıtları*:'
      ];
      if (s.activatedAt) lines.push('• ' + s.activatedAt + ' – KVKK / üyelik: verildi (sürüm ' + P.LEGAL_VERSION + ', web)');
      if (s.marketing) lines.push('• ' + (s.activatedAt || t) + ' – Kampanya izni: verildi (sürüm ' + P.LEGAL_VERSION + ', web)');
      if (!s.activatedAt && !s.marketing) lines.push('• Henüz rıza kaydı yok.');
      lines.push('', '*Damga hareketleri*:');
      lines = lines.concat(s.events.length ? s.events : ['• Henüz hareket yok.']);
      lines.push('', 'Aydınlatma metni: ' + P.KVKK_URL,
        'Silmek için SIL, kampanya izni için KAMPANYA veya DUR yazabilirsiniz.');
      return lines.join('\n');
    },
    marketingPrompt: function () {
      return P.BUSINESS + ' kampanya, indirim ve yeniliklerinden WhatsApp üzerinden haberdar olmak için izin vermek üzeresiniz (ticari elektronik ileti). ' +
        "İzniniz mevzuat gereği İleti Yönetim Sistemi'ne (İYS) kaydedilir; dilediğiniz zaman DUR yazarak vazgeçebilirsiniz.\n\n" +
        'Aydınlatma metni: ' + P.KVKK_URL + '\n\nOnaylamak için *KAMPANYA EVET* yazın.';
    },
    marketingGranted: function () {
      return 'Teşekkürler, kampanya mesajı izniniz kaydedildi. 🎉 Dilediğiniz zaman DUR yazarak vazgeçebilirsiniz.';
    },
    marketingAlreadyOn: function () { return 'Kampanya mesajı izniniz zaten açık. Kapatmak için DUR yazabilirsiniz.'; },
    optedOut: function () {
      return 'Kampanya ve tanıtım mesajları için izniniz geri alındı; artık bu tür mesaj almayacaksınız. ' +
        'Üyeliğiniz ve damgalarınız korunuyor. Yeniden izin vermek isterseniz KAMPANYA yazabilirsiniz.';
    },
    deletePrompt: function () {
      return 'Üyeliğinizi ve tüm kişisel verilerinizi kalıcı olarak silmek üzeresiniz; damgalarınız da silinir ve bu işlem geri alınamaz.\n\n' +
        'Onaylamak için *SIL EVET* yazın. Vazgeçmek için hiçbir şey yapmanız gerekmez.';
    },
    deleted: function () {
      return 'Üyeliğiniz ve kişisel verileriniz ' + P.BUSINESS + ' sadakat sisteminden silindi. ' +
        'Dilediğiniz zaman kasadaki QR kodu okutarak yeniden katılabilirsiniz. Hoşça kalın! 👋';
    },
    pendingDeleted: function () {
      return 'Onaylanmamış başvurunuz ve numaranız ' + P.BUSINESS + ' sisteminden silindi. Dilerseniz QR kodu okutarak yeniden başvurabilirsiniz.';
    },
    notMember: function () {
      return 'Bu numaraya kayıtlı bir ' + P.BUSINESS + ' üyeliği bulunamadı. Katılmak için kasadaki QR kodu okutabilir veya NFC kartı telefonunuza dokundurabilirsiniz.';
    },
    instagramLinked: function (u) {
      return 'Instagram hesabınız *@' + u + '* olarak kaydedildi. ✅ Artık ' + P.IG.handle +
        ' hesabımızı etiketlediğiniz hikaye ve gönderiler otomatik olarak damga kazandırır.';
    },
    claimReceived: function () {
      return 'Paylaşımınızı aldık, teşekkürler! 📸 Ekibimiz kontrol ettikten sonra damganız eklenecek ve size haber vereceğiz.';
    },
    help: function () {
      return P.BUSINESS + ' sadakat asistanı 🤖\n\n' +
        'KODUM – üyelik kodunuz ve damga durumunuz\n' +
        'PUANIM – damga durumunuz ve alabileceğiniz ödüller\n' +
        'INSTAGRAM – paylaşım yaparak ek damga kazanın\n' +
        'VERILERIM – hakkınızda tuttuğumuz veriler (KVKK)\n' +
        'KAMPANYA – kampanya mesajlarına izin verin\n' +
        'DUR – kampanya mesajlarını durdurun\n' +
        'SIL – üyeliğinizi ve verilerinizi silin\n' +
        'ONAY – onay bağlantısını yeniden alın\n\n' +
        'Katılmak için kasadaki QR kodu okutmanız yeterli.';
    }
  };

  /* --- sohbet günlüğüne yazma (sayfalar arası korunur) --- */
  P.push = function (s, dir, text, btn) {
    s.log.push({ d: dir, x: text, b: btn || null, t: P.now() });
    if (s.log.length > 120) s.log.splice(0, s.log.length - 120);
    return s;
  };
  P.event = function (s, text) {
    s.events.push('• ' + P.today() + ' ' + P.now() + ' – ' + text);
    if (s.events.length > 40) s.events.splice(0, s.events.length - 40);
    return s;
  };

  P.audit = function (s, islem, detay) {
    s.audit = s.audit || [];
    s.audit.unshift({ t: P.today() + ' ' + P.now(), kim: s.shift ? s.shift + ' (personel)' : 'yönetici', islem: islem, detay: detay || '' });
    if (s.audit.length > 200) s.audit.length = 200;
    return s;
  };

  // Logo adresi marka.css'teki --marka-logo değişkeninden gelir; tek kaynak orası.
  // <img> kullanılır ki hotlink kesilse bile yedek karakter görünsün ve sayfa bozulmasın.
  P.logoUygula = function (kok) {
    var ham = getComputedStyle(document.documentElement).getPropertyValue('--marka-logo').trim();
    if (!ham || ham === 'none') return;
    var url = ham.replace(/^url\((["']?)/, '').replace(/(["']?)\)$/, '');
    (kok || document).querySelectorAll('.marka-logo, .marka-yazi-logo').forEach(function (el) {
      if (el.querySelector('img')) return;
      var yedek = el.textContent;
      var img = new Image();
      img.alt = P.BUSINESS;
      img.onload = function () { el.textContent = ''; el.appendChild(img); };
      img.onerror = function () { /* yedek karakter yerinde kalır */ };
      img.src = url;
      void yedek;
    });
  };

  w.PECKO = P;
})(window);
