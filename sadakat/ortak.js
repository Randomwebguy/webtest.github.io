/* Peçko sadakat akış provası — ortak durum ve metinler.
   Durum tarayıcıda (localStorage) tutulur, böylece sohbet → onay → puan → kasa
   sayfaları arasında gidip gelindiğinde akış kaldığı yerden sürer. */
(function (w) {
  'use strict';

  var KEY = 'pecko.sadakat.prova.v1';
  var P = {};

  P.BUSINESS = 'Peçko Fırın';     // sitedeki ticari ad
  P.REWARD = { name: '1 adet hediye kahve', cost: 10 };          // öntanımlı katalog
  // Ödüller iki türlü: ürün ve yüzde indirimi. İndirim yalnızca buradan, yani
  // puan karşılığı verilir; seviye indirim vermez (bkz. P.TIERS).
  P.rewardLabel = function (r) {
    return r.tur === 'yuzde' ? '%' + r.yuzde + ' indirim' : r.ad;
  };
  P.activeRewards = function (s) {
    var list = (s && s.rewards && s.rewards.length) ? s.rewards : [{ id: 1, ad: P.REWARD.name, bedel: P.REWARD.cost, tur: 'urun', aktif: true }];
    return list.filter(function (r) { return r.aktif; }).sort(function (a, b) { return a.bedel - b.bedel; });
  };
  P.affordable = function (s) { return P.activeRewards(s).filter(function (r) { return s.stamps >= r.bedel; }); };
  P.nextReward = function (s) {
    var list = P.activeRewards(s);
    for (var i = 0; i < list.length; i++) if (list[i].bedel > s.stamps) return list[i];
    return null;
  };
  P.IG = { handle: '@peckofirin', story: 1, post: 2, max: 2, win: 60 };

  /* --- harcama seviyeleri ---
     Seviye son 12 ayın onaylı fiş toplamına göre belirlenir ve İNDİRİM DEĞİL,
     puan çarpanı verir: indirim zaten puanla alınan bir ödül türü olduğu için
     ikisi üst üste binseydi aynı alışverişe iki indirim yazılırdı. */
  P.TIER_WINDOW_DAYS = 365;
  P.TIERS = [
    { ad: 'Bronz',  esik: 0,     carpan: 1 },
    { ad: 'Gümüş',  esik: 2500,  carpan: 1.1 },
    { ad: 'Altın',  esik: 7500,  carpan: 1.25 },
    { ad: 'Platin', esik: 20000, carpan: 1.5 }
  ];
  P.tierForSpend = function (tl) {
    var cur = P.TIERS[0], next = null, i;
    for (i = 0; i < P.TIERS.length; i++) if (tl >= P.TIERS[i].esik) cur = P.TIERS[i];
    for (i = 0; i < P.TIERS.length; i++) if (P.TIERS[i].esik > tl) { next = P.TIERS[i]; break; }
    return { ad: cur.ad, carpan: cur.carpan, esik: cur.esik, harcamaTl: tl,
      sonraki: next, kalanTl: next ? Math.max(0, Math.ceil(next.esik - tl)) : 0 };
  };

  /* --- fiş okuma --- */
  // tlBasina ziyaret puanıyla aynı kefede: ortalama bir alışveriş bir puan etsin.
  // Daha düşük verilirse aynı alışveriş hem ziyaretten hem fişten puan kazandırır.
  P.RECEIPT = { tlBasina: 150, enAz: 150, enFazlaSaat: 48, gunluk: 3, kontrolUstu: 1000, enFazlaPuan: 20, pencere: 60 };
  P.puanFor = function (tl, carpan) {
    var ham = Math.floor(tl / P.RECEIPT.tlBasina);
    return Math.max(0, Math.min(P.RECEIPT.enFazlaPuan, Math.floor(ham * (carpan || 1))));
  };
  P.tl = function (n) {
    return Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
  };
  // Sayaç kutularında kuruş satırı kırar; oralarda tam TL gösterilir.
  P.tlKisa = function (n) { return Math.round(Number(n || 0)).toLocaleString('tr-TR') + ' TL'; };
  // Bu cihazdaki üyenin dönem harcaması: yalnızca onaylanmış fişler sayılır.
  P.spendOf = function (s) {
    var sinir = Date.now() - P.TIER_WINDOW_DAYS * 86400000;
    return (s.receipts || []).reduce(function (a, r) {
      return a + (r.durum === 'onaylandı' && r.ts >= sinir ? r.tutar : 0);
    }, 0);
  };
  P.tierOf = function (s) { return P.tierForSpend(P.spendOf(s)); };

  P.LEGAL_VERSION = '1.4';
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
      campaigns: null, cards: null, iys: null, ornek: null,
      receipts: null, ledger: null, fisArm: null
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
  // P.yazildi: son kaydın diske gidip gitmediği. Fotoğraflı bir günlük kotayı
  // doldurabilir; çağıran bunu görüp görselleri atarak yeniden deneyebilsin.
  P.yazildi = true;
  P.save = function (s) {
    memory = s;
    try { w.localStorage.setItem(KEY, JSON.stringify(s)); P.yazildi = true; }
    catch (e) { P.yazildi = false; }
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
        return P.rewardLabel(r) + ' (' + r.bedel + ' puan)';
      }).join(', ') + ' 🎁 Kasada kodunuzu söylemeniz yeterli.');
    }
    if (next) out.push('Sonraki ödül: ' + P.rewardLabel(next) + ' – ' + (next.bedel - s.stamps) + ' puan kaldı.');
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
      return 'Üyelik kodunuz: *' + s.code + '*\nPuan: ' + s.stamps + '\n\n' + HINT + '\n\n' + CMDS;
    },
    points: function (s) {
      var sv = P.tierOf(s);
      return 'Puan durumunuz: *' + s.stamps + '*\n' + P.rewardLines(s) +
        (s.redeemed ? '\nBugüne kadar kullandığınız ödül: ' + s.redeemed : '') +
        '\n\nSeviyeniz: *' + sv.ad + '*' + (sv.carpan > 1 ? ' (puanlarınız ×' + sv.carpan + ')' : '') +
        ' · son 12 ayda harcamanız ' + P.tl(sv.harcamaTl) +
        (sv.sonraki ? '\n' + sv.sonraki.ad + ' seviyesine ' + P.tlKisa(sv.kalanTl) + ' harcama kaldı.' : '') +
        '\n\nTüm ödüller ve ayrıntılar için aşağıdaki düğmeye dokunun (bağlantı 7 gün geçerli). ' +
        'Fişinizle puan kazanmak için FIS, Instagram paylaşımıyla ek puan için INSTAGRAM yazın.';
    },
    instagram: function (s) {
      return '📸 *Instagram bonusu*\n\n' +
        (s.ig ? 'Kayıtlı Instagram hesabınız: *@' + s.ig + '* (değiştirmek için INSTAGRAM @yenihesap yazın)\n\n'
              : 'Instagram hesabınız henüz kayıtlı değil. Kaydetmek için *INSTAGRAM @kullaniciadi* yazın; böylece paylaşımlarınız otomatik eşleşir.\n\n') +
        "Instagram'da " + P.IG.handle + ' hesabımızı etiketleyerek bir *hikaye* paylaşın (hikaye paylaşamıyorsanız gönderi de olur). ' +
        (s.ig ? 'Hesabınız herkese açıksa paylaşımınız otomatik algılanır ve puanınız eklenir. Hesabınız gizliyse veya birkaç dakika içinde mesaj gelmezse ekran görüntüsünü ' + P.IG.win + ' dakika içinde bu sohbete gönderin.'
              : 'Ardından paylaşımın ekran görüntüsünü ' + P.IG.win + ' dakika içinde bu sohbete gönderin; gönderi bağlantısını yapıştırmanız da yeterli.') +
        '\n\nHikaye +' + P.IG.story + ', gönderi +' + P.IG.post + ' puan (ayda en fazla ' + P.IG.max + ' paylaşım).';
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
        'Puan: ' + s.stamps + ' · Kullanılan ödül: ' + s.redeemed,
        'Seviye: ' + P.tierOf(s).ad + ' · Son 12 ayda harcama: ' + P.tl(P.spendOf(s)),
        'Yüklenen fiş: ' + (s.receipts || []).length,
        'Kampanya izni: ' + (s.marketing ? 'Var' : 'Yok'), '',
        '*Rıza kayıtları*:'
      ];
      if (s.activatedAt) lines.push('• ' + s.activatedAt + ' – KVKK / üyelik: verildi (sürüm ' + P.LEGAL_VERSION + ', web)');
      if (s.marketing) lines.push('• ' + (s.activatedAt || t) + ' – Kampanya izni: verildi (sürüm ' + P.LEGAL_VERSION + ', web)');
      if (!s.activatedAt && !s.marketing) lines.push('• Henüz rıza kaydı yok.');
      lines.push('', '*Puan hareketleri*:');
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
        'Üyeliğiniz ve puanlarınız korunuyor. Yeniden izin vermek isterseniz KAMPANYA yazabilirsiniz.';
    },
    deletePrompt: function () {
      return 'Üyeliğinizi ve tüm kişisel verilerinizi kalıcı olarak silmek üzeresiniz; puanlarınız da silinir ve bu işlem geri alınamaz.\n\n' +
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
        ' hesabımızı etiketlediğiniz hikaye ve gönderiler otomatik olarak puan kazandırır.';
    },
    receiptInfo: function (s) {
      var c = P.RECEIPT, sv = P.tierOf(s);
      return '🧾 *Fişinizle puan kazanın*\n\n' +
        'Mağazamızdan aldığınız fişin fotoğrafını ' + c.pencere + ' dakika içinde bu sohbete gönderin; ' +
        'tutarı okunup puanınıza eklenir.\n\n' +
        'Her *' + c.tlBasina + ' TL* için 1 puan. En az ' + c.enAz + ' TL tutarındaki fişler geçerlidir; ' +
        'fiş en fazla ' + c.enFazlaSaat + ' saatlik olmalı ve günde en çok ' + c.gunluk + ' fiş yükleyebilirsiniz.\n\n' +
        'Seviyeniz: *' + sv.ad + '*' + (sv.carpan > 1 ? ' (puanlarınız ×' + sv.carpan + ')' : '') +
        (sv.sonraki ? '\n' + sv.sonraki.ad + ' seviyesine ' + P.tlKisa(sv.kalanTl) + ' harcama kaldı.' : '') +
        '\n\nFişin tamamı görünsün, düz ve net çekin. Aynı fiş yalnızca bir kez puan kazandırır.';
    },
    receiptReceived: function () {
      return 'Fişinizi aldık, okunuyor… 🧾 Sonucu birazdan buradan bildireceğiz.';
    },
    receiptApproved: function (o) {
      return 'Fişiniz onaylandı! 🧾 ' + P.tl(o.tutar) + ' harcamanız için *+' + o.puan + ' puan* eklendi.\n' +
        'Toplam puanınız: *' + o.toplam + '*.' +
        (o.seviye && o.seviye.sonraki ? '\n\n' + o.seviye.sonraki.ad + ' seviyesine ' + P.tlKisa(o.seviye.kalanTl) + ' kaldı.' : '');
    },
    receiptPending: function (sebep) {
      return 'Fişinizi aldık. ' + sebep + ' Ekibimiz kontrol ettikten sonra puanınız eklenecek ve size haber vereceğiz. 🧾';
    },
    receiptRejected: function (sebep) {
      return 'Fişinizi maalesef puanlayamadık: ' + sebep;
    },
    claimReceived: function () {
      return 'Paylaşımınızı aldık, teşekkürler! 📸 Ekibimiz kontrol ettikten sonra puanınız eklenecek ve size haber vereceğiz.';
    },
    help: function () {
      return P.BUSINESS + ' sadakat asistanı 🤖\n\n' +
        'KODUM – üyelik kodunuz ve puan durumunuz\n' +
        'PUANIM – puan durumunuz ve alabileceğiniz ödüller\n' +
        'FIS – fişinizin fotoğrafını gönderip harcamanızdan puan kazanın\n' +
        'INSTAGRAM – paylaşım yaparak ek puan kazanın\n' +
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
  // Puan hareketi. tur/puan verilirse yapılandırılmış deftere de yazılır: üye
  // kartındaki "hangi puan nereden geldi" dökümü metinden değil bundan üretilir.
  P.event = function (s, text, tur, puan) {
    s.events.push('• ' + P.today() + ' ' + P.now() + ' – ' + text);
    if (s.events.length > 40) s.events.splice(0, s.events.length - 40);
    if (tur) {
      s.ledger = s.ledger || [];
      s.ledger.unshift({ ts: Date.now(), t: P.today() + ' ' + P.now(), tur: tur, puan: puan || 0, not: text });
      if (s.ledger.length > 60) s.ledger.length = 60;
    }
    return s;
  };

  /* --- fiş akışı: src/services/receipts.js ile aynı sıra ---------------------
     Süzgeçler üst üste biner; biri gevşetilince diğerleri açığı kapatmaz. */
  P.KAYNAK = {
    ziyaret: { ad: 'Ziyaret', ikon: '🏪' },
    fis: { ad: 'Fiş', ikon: '🧾' },
    instagram: { ad: 'Instagram', ikon: '📸' },
    odul: { ad: 'Ödül', ikon: '🎁' }
  };

  // Provada "okuma": gerçekte görseli model okur, burada senaryo üretir.
  P.fisOku = function (s, senaryo, tohum) {
    var simdi = Date.now();
    var onceki = (s.receipts || []).filter(function (r) { return r.durum === 'onaylandı'; })[0];
    var no = String(100000 + (tohum % 899999));
    switch (senaryo) {
      case 'okunmaz':
        return { okunabilir: false, not: 'Fotoğraftan fiş okunamadı. Fişin tamamı görünecek şekilde, düz ve net bir fotoğraf gönderin.' };
      case 'baska':
        return { okunabilir: true, tutar: 180, no: no, ts: simdi, isletme: 'SİMİT SARAYI ŞUBE 12', guven: 0.95 };
      case 'eski':
        return { okunabilir: true, tutar: 240, no: no, ts: simdi - 4 * 86400000, isletme: 'PEÇKO FIRIN', guven: 0.94 };
      case 'yuksek':
        return { okunabilir: true, tutar: 1450, no: no, ts: simdi, isletme: 'PEÇKO FIRIN', guven: 0.92 };
      case 'tekrar':
        return onceki
          ? { okunabilir: true, tutar: onceki.tutar, no: onceki.no, ts: onceki.fisTs, isletme: 'PEÇKO FIRIN', guven: 0.95 }
          : { okunabilir: true, tutar: 120, no: no, ts: simdi, isletme: 'PEÇKO FIRIN', guven: 0.95 };
      case 'kucuk':
        return { okunabilir: true, tutar: 95, no: no, ts: simdi, isletme: 'PEÇKO FIRIN', guven: 0.95 };
      default:
        // Fotoğraftan türetilen, makul aralıkta bir tutar. Alt sınırın üstünde
        // kalır: "geçerli fiş" senaryosu bazen reddedilirse akış anlaşılmaz olur.
        return { okunabilir: true, tutar: P.RECEIPT.enAz + 10 + (tohum % 3600) / 10, no: no, ts: simdi, isletme: 'PEÇKO FIRIN', guven: 0.93 };
    }
  };

  // Hazır senaryolarda gönderilen "fotoğraf": okunan fişin kendisi çizilir ki
  // balondaki görsel ile birazdan gelen okuma sonucu birbirini tutsun.
  P.fisGorseli = function (okuma) {
    var kagit = '#F7F3EC', m = '#3B2622', y = 92, satirlar = '';
    if (okuma.okunabilir) {
      [[3, 'Poğaça'], [2, 'Kahve'], [1, 'Yaş pasta dilim']].forEach(function (kal) {
        satirlar += '<text x="16" y="' + y + '" font-size="11" fill="' + m + '">' + kal[0] + ' x ' + kal[1] + '</text>';
        y += 18;
      });
      satirlar += '<line x1="16" y1="' + (y - 4) + '" x2="224" y2="' + (y - 4) + '" stroke="#C9BFB2" stroke-dasharray="3 3"/>' +
        '<text x="16" y="' + (y + 18) + '" font-size="14" font-weight="700" fill="' + m + '">TOPLAM</text>' +
        '<text x="224" y="' + (y + 18) + '" font-size="14" font-weight="700" text-anchor="end" fill="' + m + '">' +
        P.tl(okuma.tutar) + '</text>' +
        '<text x="16" y="' + (y + 40) + '" font-size="10" fill="#7A6C5D">FİŞ NO ' + (okuma.no || '—') + '</text>' +
        '<text x="224" y="' + (y + 40) + '" font-size="10" text-anchor="end" fill="#7A6C5D">' +
        new Date(okuma.ts).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) + '</text>';
      y += 52;
    } else {
      satirlar = '<text x="120" y="110" font-size="12" text-anchor="middle" fill="#A2968A">bulanık fotoğraf</text>';
      y = 160;
    }
    // Yükseklik içeriğe göre: balonun altında boş kâğıt kalmasın.
    var h = y + 10;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="' + h + '" viewBox="0 0 240 ' + h + '">' +
      '<rect width="240" height="' + h + '" fill="#E8E1D6"/>' +
      '<rect x="8" y="10" width="224" height="' + (h - 20) + '" rx="4" fill="' + kagit + '"' +
        (okuma.okunabilir ? '' : ' opacity=".55"') + '/>' +
      (okuma.okunabilir
        ? '<text x="120" y="40" font-size="15" font-weight="700" text-anchor="middle" fill="' + m + '">' +
          P.esc(okuma.isletme || '') + '</text>' +
          '<text x="120" y="60" font-size="10" text-anchor="middle" fill="#7A6C5D">SATIŞ FİŞİ</text>'
        : '') +
      satirlar + '</svg>';
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  };

  P.fisGonder = function (s, okuma, gorsel) {
    var c = P.RECEIPT, simdi = Date.now();
    s.receipts = s.receipts || [];
    var kayit = {
      id: 'F' + simdi, ts: simdi, t: P.today() + ' ' + P.now(),
      tutar: okuma.tutar || 0, no: okuma.no || null, fisTs: okuma.ts || null,
      fisTarih: okuma.ts ? new Date(okuma.ts).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—',
      isletme: okuma.isletme || '—', guven: okuma.guven || 0,
      durum: 'bekliyor', puan: 0, sebep: null, gorsel: gorsel || null, kod: s.code
    };
    s.receipts.unshift(kayit);

    function red(sebep) { kayit.durum = 'reddedildi'; kayit.sebep = sebep; return { durum: 'reddedildi', sebep: sebep, fis: kayit }; }
    function beklet(sebep) { kayit.sebep = sebep; return { durum: 'bekliyor', sebep: sebep, fis: kayit }; }

    // 0) Günlük sınır — okuma isteğinin maliyetini de sınırlayan süzgeç budur.
    var bugun = new Date(); bugun.setHours(0, 0, 0, 0);
    var bugunku = s.receipts.filter(function (r) { return r.ts >= bugun.getTime() && r.id !== kayit.id; }).length;
    if (bugunku >= c.gunluk) return red('Bugün için fiş sınırına ulaştınız (günde en çok ' + c.gunluk + ' fiş). Yarın tekrar deneyebilirsiniz.');
    // 1) Okunabilirlik
    if (!okuma.okunabilir || !okuma.tutar) return red(okuma.not || 'Fotoğraftan fiş okunamadı. Fişin tamamı görünecek şekilde, düz ve net bir fotoğraf gönderin.');
    // 2) Bize mi ait
    if (String(okuma.isletme || '').toLocaleUpperCase('tr-TR').indexOf('PEÇKO') < 0) {
      return red('Bu fiş bize ait görünmüyor. Yalnızca mağazalarımızdan aldığınız fişler puan kazandırır.');
    }
    // 3) Tazelik
    var yas = (simdi - okuma.ts) / 3600000;
    if (yas > c.enFazlaSaat) return red('Fiş ' + Math.round(yas) + ' saatlik; en fazla ' + c.enFazlaSaat + ' saatlik fiş kabul ediliyor.');
    if (yas < -2) return red('Fişin tarihi ileri tarihli görünüyor.');
    // 4) Alt sınır
    if (okuma.tutar < c.enAz) return red('Puan için en az ' + c.enAz + ' TL tutarında fiş gerekiyor.');
    // 5) Tekillik — parmak izi fiş no + tarih + tutardan çıkar
    kayit.iz = kayit.no + '|' + Math.floor(kayit.fisTs / 60000) + '|' + Math.round(kayit.tutar * 100);
    var tekrar = s.receipts.some(function (r) { return r.id !== kayit.id && r.iz === kayit.iz && r.durum !== 'reddedildi'; });
    if (tekrar) return red('Bu fiş daha önce yüklenmiş. Her fiş yalnızca bir kez puan kazandırır.');
    // 6) Puan
    var sv = P.tierForSpend(P.spendOf(s));
    var puan = P.puanFor(okuma.tutar, sv.carpan);
    if (!puan) return red('Bu fiş puan sınırının altında kaldı (her ' + c.tlBasina + ' TL için 1 puan).');
    kayit.puan = puan;
    // 7) Kontrole düşenler
    if (okuma.tutar > c.kontrolUstu) return beklet('Tutar yüksek olduğu için personel kontrolüne alındı.');
    if (okuma.guven < 0.75) return beklet('Okuma netleşmediği için personel kontrolüne alındı.');

    return P.fisOnayla(s, kayit);
  };

  // Onay: fişi onaylı yapar, puanı ekler ve deftere yazar. Onaylanmış fiş iki kez
  // puan vermesin diye durum kontrolü burada.
  P.fisOnayla = function (s, kayit) {
    if (kayit.durum === 'onaylandı') return { durum: 'zaten', fis: kayit };
    if (!kayit.puan) {
      var sv0 = P.tierForSpend(P.spendOf(s));
      kayit.puan = P.puanFor(kayit.tutar, sv0.carpan);
    }
    kayit.durum = 'onaylandı';
    s.stamps += kayit.puan;
    P.event(s, 'Fiş +' + kayit.puan + ' (' + P.tl(kayit.tutar) + ')', 'fis', kayit.puan);
    var sv = P.tierForSpend(P.spendOf(s));
    return { durum: 'onaylandı', puan: kayit.puan, seviye: sv, fis: kayit };
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
