/* Yönetim paneli provası. Müşteri akışıyla aynı durumu paylaşır: panelden yapılan
   işlem müşterinin sohbetine düşer, müşterinin yaptığı panelde görünür. */
(function (w) {
  'use strict';
  var P = w.PECKO, PANEL = {};

  var NAV = [
    ['', 'Özet'], ['uyeler', 'Üyeler'], ['fisler', 'Fişler'], ['oduller', 'Ödüller'],
    ['kampanyalar', 'Kampanyalar'], ['instagram', 'Instagram'], ['rapor', 'Rapor'],
    ['qr', 'QR / NFC'], ['iys', 'İYS'], ['personel', 'Personel'], ['denetim', 'Denetim'],
  ];

  /* --- örnek veri ------------------------------------------------------
     Panelin her bölümü gerçekte karşılaşacağı durumlarla dolu görünsün diye
     tohumlanır: farklı üyelik durumları, onaylanmış/reddedilmiş/bekleyen
     paylaşımlar, tamamlanmış ve yarım kalmış kampanyalar, gecikmiş İYS
     kaydı. Akıştaki gerçek üye bunlara karışmaz, listede üstte ve etiketli
     durur. MOCK sürümü artınca veri bir kez yenilenir. */
  var MOCK = 8;

  function gun(n) {   // n gün önce, gg.aa.yyyy
    return new Date(Date.now() - n * 86400000).toLocaleDateString('tr-TR');
  }
  function saat(n, s, d) { return gun(n) + ' ' + ('0' + s).slice(-2) + ':' + ('0' + (d || 0)).slice(-2); }

  // Tekrarlanabilir sözde-rastgele: sayfa her açıldığında aynı örnek veri çıksın.
  function tohumlu(n) {
    var t = n >>> 0;
    return function () { t = (t * 1103515245 + 12345) % 2147483648; return t / 2147483648; };
  }

  /* --- örnek üye üretimi ---
     Örnek veri elle yazılmaz: alışverişler GERÇEK cüzdan motoruna (P.alisverisEkle)
     verilir, tur sayacı, hediye bakiye ve son kullanma tarihleri oradan çıkar.
     Böylece paneldeki sayılarla sistemin uyguladığı kural asla ayrışmaz. */
  function uyeKur(k, i) {
    var gunSayisi = k[5], ortTl = k[6], igAdet = k[7], iadeVar = k[8];
    var rnd = tohumlu(i * 977 + 13);
    var sim = {};                 // motorun üzerinde çalışacağı geçici durum
    var hareket = [], fisler = [], igler = [], n;

    function zaman(ts) {
      var d = new Date(ts);
      return d.toLocaleDateString('tr-TR') + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }
    function yaz(ts, tur, metin, tutarKurus) {
      hareket.push({ ts: ts, t: zaman(ts), tur: tur, not: metin, kurus: tutarKurus || 0 });
    }

    // Alışveriş günleri: eskiden yeniye. Aynı güne iki fiş düşerse motor onları
    // birleştirir — örnek veride de bu durum temsil edilsin diye tekrar bırakılır.
    var gunler = [];
    for (n = 0; n < gunSayisi; n++) gunler.push(2 + Math.floor(rnd() * 240));
    gunler.sort(function (a, b) { return b - a; });

    gunler.forEach(function (gunOnce, sira) {
      var ts = Date.now() - gunOnce * 86400000 + (9 + (sira % 10)) * 3600000;
      var brut = Math.round(ortTl * (0.55 + rnd() * 0.9)) * 100;
      // Bakiyesi olan müşteri onu kullanır; kasada olan da budur.
      var kullanilabilir = P.kullanilabilir(sim, brut, ts);
      var kullan = (kullanilabilir && rnd() < 0.7) ? kullanilabilir : 0;
      var r = P.alisverisEkle(sim, { brutKurus: brut, bakiyeKurus: kullan, ts: ts, kaynak: 'kasa' });
      yaz(ts, 'alisveris', 'Alışveriş ' + P.tlk(brut) +
        (kullan ? ' (bakiye ' + P.tlk(kullan) + ')' : '') +
        (r.sayildi ? ' · ' + r.tur.alisveris + '/' + r.tur.uzunluk : ' · aynı güne eklendi'), brut);
      if (kullan) yaz(ts, 'bakiye_kullanim', 'Hediye bakiye kullanıldı', -kullan);
      if (r.parti) {
        yaz(ts + 60000, 'bakiye_kazanim', 'Tur ' + (sim.cuzdan.turNo - 1) + ' tamamlandı · ' +
          P.tlk(sim.cuzdan.gecmisTurlar[0].netKurus) + ' harcama', r.parti.tutar);
      }
      // Alışverişlerin bir kısmı fiş fotoğrafıyla geldi: fiş listesi bundan doğar.
      if (rnd() < 0.55) {
        fisler.push({ id: 'F' + i + '-' + sira, ts: ts, t: zaman(ts), tutar: brut / 100,
          no: String(100000 + Math.floor(rnd() * 899999)), fisTarih: zaman(ts),
          isletme: 'PEÇKO FIRIN', guven: Math.round((0.9 + rnd() * 0.09) * 100) / 100,
          durum: 'onaylandı', sayildi: r.sayildi, sebep: null });
      }
    });

    // Instagram bonusu da bakiye veriyor.
    for (n = 0; n < igAdet; n++) {
      var g = 3 + Math.floor(rnd() * 100);
      var igTs = Date.now() - g * 86400000;
      var tur = n % 3 === 2 ? 'gönderi' : 'hikaye';
      var kurus = P.kurus(tur === 'gönderi' ? P.IG.postTl : P.IG.storyTl);
      P.bakiyeVer(sim, kurus, 'instagram', igTs);
      igler.push({ tur: tur, tarih: zaman(igTs), durum: 'onaylandı', bakiyeKurus: kurus,
        kaynak: k[3] ? 'otomatik eşleşme' : 'ekran görüntüsü' });
      yaz(igTs, 'instagram', 'Instagram ' + tur + ' bonusu', kurus);
    }

    // Bir üyede iade olsun: kuralın panelde görünmesi için.
    if (iadeVar && sim.alisverisler && sim.alisverisler.length) {
      var hedef = sim.alisverisler[0];
      var iade = Math.round(hedef.netKurus * 0.6);
      var ri = P.iadeEkle(sim, { tutarKurus: iade, gun: hedef.gun });
      if (ri.ok) yaz(hedef.sonTs || hedef.ts, 'iade', 'İade' + (ri.sayimDustu ? ' · alışveriş sayısı düştü' : ''), -ri.dusulen);
    }

    P.bakiyeTemizle(sim);
    hareket.sort(function (a, b) { return b.ts - a.ts; });
    fisler.reverse();
    var ilkTs = sim.alisverisler && sim.alisverisler.length
      ? sim.alisverisler[sim.alisverisler.length - 1].ts : null;
    return {
      kod: P.newCode(), ad: k[0], durum: k[1], pazarlama: k[2], ig: k[3], nokta: k[4],
      cuzdan: sim.cuzdan || null, alisverisler: sim.alisverisler || [],
      fisler: fisler, igler: igler, hareket: hareket.slice(0, 24),
      // Kayıt tarihi uydurulmaz: ilk alışverişten birkaç gün öncesi. Hiç hareketi
      // olmayan (onay bekleyen) üyeler yeni başvuru sayılır, son günlere düşer.
      tarih: ilkTs ? gun(Math.round((Date.now() - ilkTs) / 86400000) + 2 + (i % 5)) : gun(1 + (i % 9)),
      ornek: true
    };
  }

  function seed(S) {
    if (S.mockSurum === MOCK) return S;

    // Ürün ödülleri ve kademeli yüzde indirimi aynı katalogda: indirim yalnızca
    // buradan, puan karşılığı verilir — seviye indirim vermez.
    S.rewards = [
      { id: 1, ad: 'Kurabiye (100 gr)', bedel: 5, tur: 'urun', aktif: true },
      { id: 2, ad: '1 adet hediye kahve', bedel: 10, tur: 'urun', aktif: true },
      { id: 3, ad: 'Dilim yaş pasta', bedel: 16, tur: 'urun', aktif: true },
      { id: 4, ad: 'Yaz limonatası', bedel: 8, tur: 'urun', aktif: false },
      { id: 5, ad: '%5 indirim', yuzde: 5, bedel: 10, tur: 'yuzde', aktif: true },
      { id: 6, ad: '%10 indirim', yuzde: 10, bedel: 20, tur: 'yuzde', aktif: true },
      { id: 7, ad: '%15 indirim', yuzde: 15, bedel: 35, tur: 'yuzde', aktif: true },
    ];

    S.staff = [
      { id: 1, ad: 'Zeynep', aktif: true },
      { id: 2, ad: 'Mert', aktif: true },
      { id: 3, ad: 'Selin', aktif: true },
      { id: 4, ad: 'Onur', aktif: false },
    ];

    S.cards = [
      { token: 'KASA1', etiket: 'Kasa 1', tur: 'kasa', aktif: true, qr: 214, nfc: 96, nfcDurum: 'kilitli' },
      { token: 'MASA3', etiket: 'Masa 3', tur: 'masa', aktif: true, qr: 63, nfc: 41, nfcDurum: 'yazıldı' },
      { token: 'PAKET', etiket: 'Paket servis çıkışı', tur: 'kasa', aktif: false, qr: 12, nfc: 0, nfcDurum: 'yazılmadı' },
    ];

    // Üyelik durumlarının tamamı temsil edilir: aktif, onay bekleyen, silinmiş;
    // izinli/izinsiz; Instagram hesabı olan ve olmayan. Tur ilerlemesi de dağınık:
    // turunu yeni kapatan, ortasında olan ve hiç başlamamış üyeler bir arada.
    // Alanlar: ad, durum, izin, instagram, nokta, alışveriş günü, ortalama gün
    // tutarı (TL), Instagram paylaşımı, iade var mı.
    var kisiler = [
      ['Ayşe Yıldız',   'active',  true,  'ayseyildiz', 'KASA1', 34, 380, 4, false],
      ['Mehmet Kaya',   'active',  false, null,         'KASA1', 23, 165, 0, true ],
      ['Elif Demir',    'active',  true,  'elifdemir',  'MASA3',  6, 240, 3, false],
      ['Burak Şen',     'pending', false, null,         'KASA1',  0,   0, 0, false],
      ['Zeynep Ak',     'active',  true,  'zeynep.ak',  'KASA1', 27, 310, 5, false],
      ['Caner Öz',      'active',  false, null,         'MASA3', 14, 145, 0, false],
      ['Derya Tunç',    'active',  true,  'deryatunc',  'KASA1', 19, 265, 2, true ],
      ['Emre Balcı',    'active',  false, null,         'KASA1',  2, 130, 0, false],
      ['Fatma Arslan',  'active',  true,  null,         'MASA3', 31, 420, 0, false],
      ['Gökhan Yurt',   'pending', false, null,         'MASA3',  0,   0, 0, false],
      ['Hale Kurt',     'active',  true,  'halekurt',   'KASA1',  9, 175, 1, false],
      ['İlker Doğan',   'active',  false, null,         'KASA1', 16, 220, 0, false],
      ['Jale Erdem',    'deleted', false, null,         'KASA1',  0,   0, 0, false],
      ['Kemal Aydın',   'active',  true,  null,         'PAKET',  5, 110, 0, false],
    ];
    S.ornek = kisiler.map(function (k, i) { return uyeKur(k, i); });

    // Personel kontrolüne düşen fişler: yüksek tutar, düşük okuma güveni ve
    // reddedilmiş bir örnek. Bunlar alışveriş hesabına SAYILMAZ; onaylanınca işlenir.
    function fisEkle(ad, fis) {
      var u = S.ornek.filter(function (x) { return x.ad === ad; })[0];
      if (!u) return;
      fis.id = 'F' + ad.length + '-' + Math.round(fis.tutar * 100);
      fis.uye = u.kod; fis.no = fis.no || String(100000 + Math.round(fis.tutar));
      fis.fisTarih = fis.t;
      fis.fisTs = fis.ts;
      u.fisler.unshift(fis);
    }
    fisEkle('Ayşe Yıldız', { ts: Date.now() - 3600000, t: saat(0, 12, 35), tutar: 1680, isletme: 'PEÇKO FIRIN',
      guven: 0.94, durum: 'bekliyor', sebep: 'Tutar yüksek olduğu için personel kontrolüne alındı.' });
    fisEkle('Caner Öz', { ts: Date.now() - 5 * 3600000, t: saat(0, 10, 5), tutar: 214.5, isletme: 'PEÇKO FIRIN',
      guven: 0.61, durum: 'bekliyor', sebep: 'Okuma netleşmediği için personel kontrolüne alındı.' });
    fisEkle('Derya Tunç', { ts: Date.now() - 26 * 3600000, t: saat(1, 19, 10), tutar: 320, isletme: 'PEÇKO FIRIN',
      guven: 0.58, durum: 'bekliyor', sebep: 'Okuma netleşmediği için personel kontrolüne alındı.' });
    fisEkle('Hale Kurt', { ts: Date.now() - 2 * 86400000, t: saat(2, 15, 40), tutar: 96, isletme: 'SİMİT SARAYI ŞUBE 12',
      guven: 0.93, durum: 'reddedildi',
      sebep: 'Bu fiş bize ait görünmüyor. Yalnızca mağazalarımızdan aldığınız fişler işleme alınır.' });
    fisEkle('Mehmet Kaya', { ts: Date.now() - 3 * 86400000, t: saat(3, 8, 20), tutar: 0, isletme: '—',
      guven: 0.2, durum: 'reddedildi',
      sebep: 'Fotoğraftan fiş okunamadı. Fişin tamamı görünecek şekilde, düz ve net bir fotoğraf gönderin.' });

    // Instagram: otomatik eşleşen, personel onaylı, reddedilen ve bekleyenler.
    S.claims = [
      { id: 9001, kullanici: '@deryatunc',   tur: 'hikaye',  durum: 'bekliyor',    bakiyeKurus: P.kurus(P.IG.storyTl), tarih: saat(0, 11, 20), kaynak: 'gizli hesap · ekran görüntüsü' },
      { id: 9002, kullanici: '(eşleşmedi)',  tur: 'gönderi', durum: 'bekliyor',    bakiyeKurus: P.kurus(P.IG.postTl), tarih: saat(0, 9, 45),  kaynak: 'ekran görüntüsü' },
      { id: 9003, kullanici: '@ayseyildiz',  tur: 'hikaye',  durum: 'onaylandı',   bakiyeKurus: P.kurus(P.IG.storyTl), tarih: saat(1, 16, 5),  kaynak: 'otomatik eşleşme' },
      { id: 9004, kullanici: '@zeynep.ak',   tur: 'gönderi', durum: 'onaylandı',   bakiyeKurus: P.kurus(P.IG.postTl), tarih: saat(2, 13, 30), kaynak: 'otomatik eşleşme' },
      { id: 9005, kullanici: '@halekurt',    tur: 'hikaye',  durum: 'reddedildi',  bakiyeKurus: 0, tarih: saat(4, 18, 12), kaynak: 'etiket görünmüyor' },
      { id: 9006, kullanici: '@elifdemir',   tur: 'hikaye',  durum: 'onaylandı',   bakiyeKurus: P.kurus(P.IG.storyTl), tarih: saat(6, 12, 0),  kaynak: 'otomatik eşleşme' },
    ];

    // Kampanyalar: tamamlanmış, hatalı alıcısı olan ve henüz gönderilmemiş taslak.
    S.campaigns = [
      { id: 8001, ad: 'Ekim kahve kampanyası', sablon: 'ekim_kampanya', durum: 'tamam',
        alici: 41, gonderildi: 38, atlandi: 2, hata: 1, olusturma: gun(9) },
      { id: 8002, ad: 'Hafta sonu brunch', sablon: 'brunch_duyuru', durum: 'tamam',
        alici: 36, gonderildi: 36, atlandi: 0, hata: 0, olusturma: gun(23) },
      { id: 8003, ad: 'Yılbaşı ön sipariş', sablon: 'yilbasi_onsiparis', durum: 'taslak',
        alici: 0, gonderildi: 0, atlandi: 0, hata: 0, olusturma: gun(0) },
    ];

    // İYS: bekleyen, aktarılmış, ret ve mevzuat süresini aşmış bir kayıt.
    S.iys = [
      { alici: '+905321110042', tur: 'ONAY', kaynak: 'onay sayfası', tarih: gun(1),  aktarim: false },
      { alici: '+905321110018', tur: 'ONAY', kaynak: 'onay sayfası', tarih: gun(2),  aktarim: false },
      { alici: '+905321110077', tur: 'RET',  kaynak: 'WhatsApp DUR', tarih: gun(6),  aktarim: false, gecikmis: true },
      { alici: '+905321110033', tur: 'RET',  kaynak: 'üyelik silme', tarih: gun(11), aktarim: true },
      { alici: '+905321110091', tur: 'ONAY', kaynak: 'onay sayfası', tarih: gun(12), aktarim: true },
      { alici: '+905321110005', tur: 'ONAY', kaynak: 'WhatsApp KAMPANYA', tarih: gun(15), aktarim: true },
    ];

    S.audit = [
      { t: saat(0, 10, 12), kim: 'Zeynep (personel)', islem: 'alisveris.kaydedildi', detay: '285,00 TL · Kasa 1' },
      { t: saat(0, 9, 48),  kim: 'Mert (personel)',   islem: 'bakiye.kullanildi',   detay: '120,00 TL · 480 TL fişte' },
      { t: saat(0, 12, 36), kim: 'sistem',            islem: 'fis.kontrol',         detay: '1.680,00 TL · tutar yüksek' },
      { t: saat(0, 11, 2),  kim: 'sistem',            islem: 'fis.onay',            detay: '465,00 TL · alışverişe işlendi' },
      { t: saat(0, 10, 40), kim: 'sistem',            islem: 'tur.tamamlandi',      detay: 'tur 3 · 3.420,00 TL → 171,00 TL bakiye' },
      { t: saat(1, 17, 3),  kim: 'yönetici',          islem: 'instagram.onay',      detay: '@ayseyildiz · +1' },
      { t: saat(2, 15, 41), kim: 'sistem',            islem: 'fis.red',             detay: 'unvan eşleşmedi' },
      { t: saat(1, 14, 22), kim: 'yönetici',          islem: 'customer.phone_revealed', detay: 'gerekçe: bakiye itirazı' },
      { t: saat(2, 19, 40), kim: 'yönetici',          islem: 'kampanya.gonderildi', detay: 'Ekim kahve kampanyası · 38 mesaj' },
      { t: saat(3, 11, 15), kim: 'Selin (personel)',  islem: 'iade.islendi',        detay: '180,00 TL · alışveriş sayısı düştü' },
      { t: saat(4, 18, 30), kim: 'yönetici',          islem: 'instagram.red',       detay: '@halekurt' },
      { t: saat(5, 9, 5),   kim: 'yönetici',          islem: 'iys.aktarim',         detay: '12 kayıt' },
      { t: saat(7, 16, 50), kim: 'yönetici',          islem: 'customer.deleted',    detay: 'KVKK silme talebi' },
      { t: saat(9, 12, 0),  kim: 'yönetici',          islem: 'bakiye.suresi_doldu', detay: '4 üye · 310,00 TL' },
      { t: saat(12, 8, 40), kim: 'yönetici',          islem: 'personel.pasif',      detay: 'Onur' },
      { t: saat(12, 8, 35), kim: 'yönetici',          islem: 'oturum.kapatildi',    detay: '3 oturum' },
    ];

    // Giden mesaj sağlığı: başarısız gönderimlerin görünür olması panelin asıl
    // işlevlerinden biri — erişim anahtarı düşerse ilk uyarı buradan gelir.
    S.giden = {
      gonderildi: 312, basarisiz: 2, saat: 24,
      hatalar: [
        { t: saat(0, 8, 12), tur: 'bakiye bildirimi',
          hata: '(#131047) 24 saatlik pencere kapalı; şablon tanımlı değil' },
        { t: saat(0, 7, 40), tur: 'kampanya',
          hata: '(#130429) Dakikalık gönderim sınırı aşıldı, alıcı kuyrukta kaldı' },
      ],
    };
    S.isler = [
      { ad: 'Saklama süresi temizliği', son: saat(0, 4, 0), hata: null },
      { ad: 'Instagram etiket sorgusu', son: saat(0, 9, 55), hata: null },
      { ad: 'Fiş okuma', son: saat(0, 12, 35), hata: null },
      { ad: 'Kampanya gönderimi', son: saat(0, 9, 40), hata: null },
    ];

    S.mockSurum = MOCK;
    P.save(S);
    return S;
  }
  function yeniTarih(n) { return gun(-n); }

  /* --- üyeler: akıştaki gerçek üye + örnekler ---
     Her iki taraf da aynı alanlara sahip olsun ki üye kartı tek kodla çizilsin.
     Gerçek üyenin cüzdanı doğrudan durumdan gelir; örnek üyelerinki üretim
     sırasında aynı motorla kurulmuştu. */
  function uyeler(S) {
    var out = [];
    if (S.code) {
      out.push({ kod: S.code, ad: 'Test Müşteri', durum: S.status,
        pazarlama: S.marketing, ig: S.ig, nokta: S.token,
        tarih: (S.createdAt || '').split(' ')[0] || P.today(), gercek: true,
        cuzdan: S.cuzdan || null, alisverisler: S.alisverisler || [],
        fisler: S.receipts || [],
        igler: (S.claims || []).filter(function (c) { return c.gercek; }).map(function (c) {
          return { tur: c.tur, tarih: c.tarih, durum: c.durum, bakiyeKurus: c.bakiyeKurus, kaynak: c.kaynak };
        }),
        hareket: (S.events || []).slice().reverse().map(function (e) { return { t: '', not: e, tur: 'olay', kurus: 0 }; }) });
    }
    return out.concat(S.ornek || []);
  }

  // Cüzdan okumaları üyenin kendi durumu üzerinden yapılır; motorun fonksiyonları
  // {cuzdan, alisverisler} şeklinde bir nesne beklediği için üye doğrudan verilir.
  function bakiyeOf(u) { return u.cuzdan ? P.aktifBakiye(u) : 0; }
  function turOf(u) { return P.turDurumu(u); }
  function sonKullanmaOf(u) { return u.cuzdan ? P.ilkSonKullanma(u) : null; }
  // Ömür boyu net harcama: turların toplamı + açık turun içindekiler.
  function harcamaOf(u) {
    if (!u.cuzdan) return 0;
    var gecmis = (u.cuzdan.gecmisTurlar || []).reduce(function (a, g) { return a + g.netKurus; }, 0);
    return gecmis + (u.cuzdan.turNetKurus || 0);
  }
  function kazanilanOf(u) {
    if (!u.cuzdan) return 0;
    return (u.cuzdan.partiler || []).reduce(function (a, x) { return a + x.tutar; }, 0);
  }
  // kazanılan − kullanılan − dolan = açık bakiye. Üçü de partilerden okunur.
  function kullanilanOf(u) {
    if (!u.cuzdan) return 0;
    return (u.cuzdan.partiler || []).reduce(function (a, x) {
      return a + (x.tutar - x.kalan - (x.dolan || 0));
    }, 0);
  }
  function dolanOf(u) {
    if (!u.cuzdan) return 0;
    return (u.cuzdan.partiler || []).reduce(function (a, x) { return a + (x.dolan || 0); }, 0);
  }
  function alisverisSayisi(u) {
    return (u.alisverisler || []).filter(function (a) { return a.sayildi; }).length;
  }
  function fisSay(u, durum) {
    return (u.fisler || []).filter(function (r) { return r.durum === durum; }).length;
  }
  // Panelin tamamındaki fişler tek listede: Fişler sekmesi bunun üzerinde çalışır.
  function tumFisler(S) {
    var out = [];
    uyeler(S).forEach(function (u) {
      (u.fisler || []).forEach(function (r) { out.push({ fis: r, uye: u }); });
    });
    return out.sort(function (a, b) { return b.fis.ts - a.fis.ts; });
  }
  // Açık bakiye yükümlülüğü: işletmenin kasada karşılamayı taahhüt ettiği tutar.
  function acikYukumluluk(S) {
    return uyeler(S).reduce(function (a, u) { return a + bakiyeOf(u); }, 0);
  }

  /* --- yerleşim --- */
  function kabuk(S, aktif, baslik, govde) {
    var nav = NAV.map(function (n) {
      var yol = n[0] ? '../' + (aktif ? '' : '') + n[0] + '/' : '../';
      if (!aktif) yol = n[0] ? n[0] + '/' : './';
      return '<a href="' + yol + '"' + (n[0] === aktif ? ' class="on"' : '') + '>' + n[1] + '</a>';
    }).join('');
    return '<div class="app">' +
      '<header class="pbar"><span class="marka-yazi-logo">Peçko Fırın</span><b>' + P.esc(baslik) + '</b>' +
        '<span class="rol">' + (S.shift ? P.esc(S.shift) : 'yönetici') + '</span>' +
        '<a href="' + (aktif ? '../../' : '../') + 'sohbet/">Müşteri</a></header>' +
      '<nav class="pnav">' + nav + '</nav>' +
      '<div class="body"><div class="pad">' + govde + '</div></div></div>';
  }

  PANEL.init = function (sayfa) {
    var S = seed(P.load());
    var c = SAYFA[sayfa || ''];
    document.body.innerHTML = kabuk(S, sayfa || '', c.baslik, c.ciz(S));
    P.logoUygula();
    if (c.bagla) c.bagla(S);
    document.body.addEventListener('click', function (e) {
      var b = e.target.closest('[data-is]');
      if (b) { ISLER[b.dataset.is](P.load(), b); }
    });
  };

  // Panelden müşteriye mesaj: sohbet açıldığında kutudan alınır.
  function mesaj(S, metin, sys, btn) {
    S.inbox = S.inbox || [];
    S.inbox.push({ text: metin, sys: sys || null, btn: btn || null });
  }
  function yenile() { location.reload(); }
  function csvIndir(ad, satirlar) {
    // Excel Türkçe karakterleri doğru açsın diye BOM + noktalı virgül.
    var csv = '﻿' + satirlar.map(function (r) {
      return r.map(function (v) {
        v = v == null ? '' : String(v);
        return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(';');
    }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = ad; document.body.appendChild(a); a.click(); a.remove();
  }

  var ISLER = {};

  /* ===================== ÖZET ===================== */
  var SAYFA = {};
  SAYFA[''] = {
    baslik: 'Panel',
    ciz: function (S) {
      var u = uyeler(S), aktif = u.filter(function (x) { return x.durum === 'active'; });
      var bekleyen = (S.claims || []).filter(function (c) { return c.durum === 'bekliyor'; }).length;
      var iysBekleyen = (S.iys || []).filter(function (r) { return !r.aktarim; }).length;
      var fisBekleyen = tumFisler(S).filter(function (x) { return x.fis.durum === 'bekliyor'; }).length;
      var g = gunlukOzet(S, 30);
      var yuk = acikYukumluluk(S);
      // Turunu doldurmaya yakın üyeler: kampanya ve stok planlamasının girdisi.
      var yakin = aktif.filter(function (x) { return turOf(x).kalan > 0 && turOf(x).kalan <= 2; }).length;
      var sonUyeler = u.slice(0, 4).map(uyeSatiri).join('');
      return '<dl class="tiles">' +
          kutu('Aktif üye', aktif.length) +
          kutu('Açık bakiye', P.tlkKisa(yuk)) +
          kutu('30 günde ciro', P.tlkKisa(g.netKurus)) +
          kutu('30 günde alışveriş', g.alisveris) +
          kutu('Tur dolmasına 1-2 kalan', yakin) +
          kutu('Bekleyen fiş', fisBekleyen) +
        '</dl>' +
        '<div class="uyari"><b>Açık bakiye</b>, üyelerin kazanıp henüz kullanmadığı ' +
          'hediye bakiyenin toplamı — işletmenin kasada karşılamayı taahhüt ettiği tutar. ' +
          'Süresi dolan bakiye bu rakamdan kendiliğinden düşer.</div>' +
        (fisBekleyen ? '<div class="uyari"><b>' + fisBekleyen + ' fiş onay bekliyor.</b> ' +
          'Yüksek tutarlı ve okuması netleşmeyen fişler personel kararını bekler.' +
          '<a class="btn btn-sec" href="fisler/" style="margin-top:.6rem">Fişleri aç</a></div>' : '') +
        (bekleyen || iysBekleyen
          ? '<p class="sub" style="margin:0 0 .9rem">Ayrıca ' + bekleyen + ' Instagram paylaşımı ve ' +
            iysBekleyen + ' İYS kaydı bekliyor.</p>' : '') +
        sistemDurumu(S) +
        '<h2 style="font-size:1rem;margin:1rem 0 .5rem;color:var(--cocoa)">Son üyeler</h2>' +
        (sonUyeler ? '<div class="list">' + sonUyeler + '</div>' : '<p class="bosluk">Henüz üye yok. QR akışını tamamlayın.</p>') +
        '<a class="btn btn-sec" href="../kasa/">Kasa ekranını aç</a>';
    }
  };

  /* Dönem özeti: tüm üyelerin alışveriş günlerinden ve bakiye partilerinden
     hesaplanır. Ayrı bir sahte olay günlüğü yok — panelde görünen her sayının
     karşılığı bir üyenin kaydında duruyor. */
  function gunlukOzet(S, gunSayisi) {
    var sinir = Date.now() - gunSayisi * 86400000;
    var o = { alisveris: 0, netKurus: 0, brutKurus: 0, bakiyeKullanilan: 0, iade: 0,
      kazanilan: 0, tur: 0, yeniUye: 0 };
    uyeler(S).forEach(function (u) {
      (u.alisverisler || []).forEach(function (a) {
        if (a.ts < sinir) return;
        if (a.sayildi) o.alisveris++;
        o.netKurus += a.netKurus; o.brutKurus += a.brutKurus;
        o.bakiyeKullanilan += a.bakiyeKurus; o.iade += a.iadeKurus;
      });
      ((u.cuzdan && u.cuzdan.gecmisTurlar) || []).forEach(function (t) {
        if (t.kapanisTs >= sinir) { o.tur++; o.kazanilan += t.bakiyeKurus; }
      });
      var gf = gunFarki(u.tarih);
      if (gf !== null && gf < gunSayisi) o.yeniUye++;
    });
    return o;
  }

  function kutu(ad, deger) { return '<div class="tile"><dt>' + ad + '</dt><dd>' + deger + '</dd></div>'; }

  function sistemDurumu(S) {
    var g = S.giden || { gonderildi: 0, basarisiz: 0, saat: 24, hatalar: [] };
    var kendi = (S.log || []).filter(function (l) { return l.d === 'in'; }).length;
    var isler = (S.isler || []).map(function (i) {
      return '<li><span>' + i.ad + '</span><span class="right">' +
        (i.hata ? '<span class="tag red">hata</span>' : '<span class="tag ok">çalışıyor</span>') +
        '<br><span style="font-size:.72rem;color:var(--muted)">' + i.son + '</span></span></li>';
    }).join('');
    return '<div class="form"><h3>Sistem durumu</h3>' +
      '<p style="font-size:.86rem;margin:0 0 .6rem">Son ' + g.saat + ' saatte <b>' +
        (g.gonderildi + kendi) + '</b> mesaj gönderildi' +
        (g.basarisiz ? ', <b style="color:var(--marka-kirmizi)">' + g.basarisiz + '</b> tanesi başarısız.' : ', hepsi başarılı.') + '</p>' +
      (g.hatalar && g.hatalar.length
        ? '<div class="tw" style="margin-bottom:.6rem"><table class="t"><thead><tr><th>Zaman</th><th>Tür</th><th>Hata</th></tr></thead><tbody>' +
          g.hatalar.map(function (h) {
            return '<tr><td style="white-space:nowrap">' + h.t + '</td><td>' + h.tur + '</td><td>' + P.esc(h.hata) + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '') +
      '<ul class="isler">' + isler + '</ul></div>';
  }
  function rozet(d) {
    return '<span class="tag ' + ({ active: 'ok', pending: 'bek', deleted: 'sil' }[d] || 'sil') + '">' +
      ({ active: 'aktif', pending: 'onay bekliyor', deleted: 'silindi' }[d] || d) + '</span>';
  }

  /* ===================== ÜYELER ===================== */
  SAYFA.uyeler = {
    baslik: 'Üyeler',
    ciz: function (S) {
      return '<form class="srch" id="ara"><input id="q" placeholder="Kod, isim veya Instagram" ' +
          'autocomplete="off"><button class="btn btn-primary" style="width:auto;padding:0 1rem">Ara</button></form>' +
        '<div class="filtre" id="f">' +
          ['', 'active', 'pending', 'deleted'].map(function (v, i) {
            return '<button data-d="' + v + '"' + (i === 0 ? ' class="on"' : '') + '>' +
              ['Tümü', 'Aktif', 'Onay bekleyen', 'Silinen'][i] + '</button>';
          }).join('') + '</div>' +
        '<div id="liste"></div>' +
        '<button class="btn btn-sec" data-is="uyeCsv">Üye listesini CSV indir</button>' +
        '<p style="font-size:.78rem;color:var(--muted);margin:.6rem 0 0">Dosyada telefon numarası yer almaz; ' +
        'numara üye sayfasından tek tek ve denetim kaydıyla açılır.</p>';
    },
    bagla: function (S) {
      var durum = '', q = '';
      function ciz() {
        var liste = uyeler(S).filter(function (x) {
          if (durum && x.durum !== durum) return false;
          if (!q) return true;
          var t = (x.kod + ' ' + x.ad + ' ' + (x.ig || '')).toLocaleLowerCase('tr-TR');
          return t.indexOf(q.toLocaleLowerCase('tr-TR')) > -1;
        });
        document.getElementById('liste').innerHTML = liste.length
          ? '<div class="list">' + liste.map(uyeSatiri).join('') + '</div>'
          : '<p class="bosluk">Bu süzgece uyan üye yok.</p>';
      }
      document.getElementById('ara').addEventListener('submit', function (e) {
        e.preventDefault(); q = document.getElementById('q').value.trim(); ciz();
      });
      document.getElementById('f').addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        durum = b.dataset.d;
        [].forEach.call(this.querySelectorAll('button'), function (x) { x.classList.toggle('on', x === b); });
        ciz();
      });
      ciz();
    }
  };
  // Satırın tamamı düğme: dokunulduğunda üye kartı açılır.
  function uyeSatiri(x) {
    var tur = turOf(x), bakiye = bakiyeOf(x), bek = fisSay(x, 'bekliyor');
    var skt = sonKullanmaOf(x);
    return '<button type="button" class="item" data-is="uyeKart" data-kod="' + x.kod + '">' +
      '<span><span class="mono">' + x.kod + '</span>' +
      '<span class="sub">' + P.esc(x.ad) + (x.gercek ? ' · <b>bu cihazdaki üye</b>' : '') +
      (x.ig ? ' · @' + P.esc(x.ig) : '') + ' · ' + (x.nokta || '—') + ' · ' + x.tarih + '</span>' +
      '<span class="sub">' + P.tlkKisa(harcamaOf(x)) + ' harcama · ' +
      (x.cuzdan ? (x.cuzdan.gecmisTurlar || []).length + ' tur tamamlandı' : 'tur yok') +
      (bek ? ' · <b>' + bek + ' fiş bekliyor</b>' : '') + '</span></span>' +
      '<span class="right">' +
      (bakiye ? '<b style="color:var(--ok)">' + P.tlkKisa(bakiye) + '</b>' : '<span class="sub">bakiye yok</span>') +
      '<br><span class="sub">' + tur.alisveris + '/' + tur.uzunluk + ' alışveriş</span>' +
      (skt ? '<br><span class="sub">skt ' + P.gunAdi(P.gunKodu(skt.sonKullanmaTs)) + '</span>' : '') +
      '<br>' + rozet(x.durum) + (x.pazarlama ? ' <span class="tag ok">izinli</span>' : '') +
      '<span class="ok">›</span></span></button>';
  }
  ISLER.uyeKart = function (S, b) { kartAc(b.dataset.kod); };

  ISLER.uyeCsv = function (S) {
    var satir = [['Üye kodu', 'Durum', 'Ad', 'Instagram', 'Açık bakiye (TL)', 'Son kullanma',
      'Bu turda alışveriş', 'Tamamlanan tur', 'Ömür boyu net harcama (TL)', 'Kazanılan bakiye (TL)',
      'Kullanılan bakiye (TL)', 'Kampanya izni', 'Kayıt noktası', 'Kayıt']];
    function tl(kurus) { return (kurus / 100).toFixed(2).replace('.', ','); }
    uyeler(S).forEach(function (x) {
      var tur = turOf(x), skt = sonKullanmaOf(x);
      satir.push([x.kod, { active: 'Aktif', pending: 'Onay bekliyor', deleted: 'Silindi' }[x.durum] || x.durum,
        x.ad, x.ig ? '@' + x.ig : '', tl(bakiyeOf(x)),
        skt ? P.gunAdi(P.gunKodu(skt.sonKullanmaTs)) : '',
        tur.alisveris + '/' + tur.uzunluk, x.cuzdan ? (x.cuzdan.gecmisTurlar || []).length : 0,
        tl(harcamaOf(x)), tl(kazanilanOf(x)), tl(kullanilanOf(x)),
        x.pazarlama ? 'Evet' : 'Hayır', x.nokta || '', x.tarih]);
    });
    P.audit(S, 'uye.disa_aktarim', satir.length - 1 + ' kayıt'); P.save(S);
    csvIndir('uyeler-' + P.today().replace(/\./g, '-') + '.csv', satir);
  };

  /* ===================== ÜYE KARTI (modal) =====================
     Bir üyeye dokunulduğunda açılır: hediye bakiyesi ve son kullanma tarihi,
     bulunduğu turun neresinde olduğu, alışveriş geçmişi (aynı gün fişleri
     birleşmiş hâlde), yüklediği fişler, Instagram paylaşımları ve hesap
     hareketleri. Sayılar üyenin kendi cüzdanından okunur; panel hiçbir şeyi
     yeniden hesaplamaz, bu yüzden kasadaki gerçekle ayrışamaz. */
  function kartAc(kod) {
    var S = P.load(), u = uyeler(S).filter(function (x) { return x.kod === kod; })[0];
    if (!u) return;
    var eski = document.getElementById('kart');
    if (eski) eski.remove();
    var d = document.createElement('div');
    d.className = 'kart'; d.id = 'kart';
    d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
    d.setAttribute('aria-label', u.ad + ' üye kartı');
    d.innerHTML = '<div class="kart-in">' + kartIcerik(u) + '</div>';
    document.body.appendChild(d);
    document.body.classList.add('kilit');
    d.addEventListener('click', function (e) { if (e.target === d) kartKapat(); });
    var kapat = d.querySelector('[data-kapat]');
    if (kapat) { kapat.addEventListener('click', kartKapat); kapat.focus(); }
  }
  function kartKapat() {
    var d = document.getElementById('kart');
    if (d) d.remove();
    document.body.classList.remove('kilit');
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') kartKapat(); });

  function kartIcerik(u) {
    // Süresi dolan partiler burada işaretlenir: döküm satırı olmadan
    // "kazanılan − kullanılan" toplamı açık bakiyeyi tutmaz.
    if (u.cuzdan) P.bakiyeTemizle(u);
    var tur = turOf(u), bakiye = bakiyeOf(u), skt = sonKullanmaOf(u);
    var harcama = harcamaOf(u), kazanilan = kazanilanOf(u), kullanilan = kullanilanOf(u);
    var dolan = dolanOf(u);
    var bekleyen = fisSay(u, 'bekliyor');
    var c = P.CUZDAN;

    // Tur sayacı: 10 kutucuk. Sahibin "müşteri nerede" sorusunun tek bakışta cevabı.
    var kutular = '';
    for (var i = 0; i < tur.uzunluk; i++) kutular += '<i class="' + (i < tur.alisveris ? 'on' : '') + '"></i>';

    // Bakiye partileri: hangi para ne zaman ölüyor.
    var partiler = ((u.cuzdan && u.cuzdan.partiler) || []).filter(function (p) { return p.kalan > 0; })
      .sort(function (a, b) { return a.sonKullanmaTs - b.sonKullanmaTs; })
      .map(function (p) {
        var kalanGun = Math.ceil((p.sonKullanmaTs - Date.now()) / 86400000);
        return '<div class="item"><span><b>' + P.tlk(p.kalan) + '</b>' +
          '<span class="sub">' + (p.sebep === 'instagram' ? 'Instagram bonusu' : 'Tur ' + p.turNo + ' ödülü') +
          ' · kazanıldı ' + P.gunAdi(P.gunKodu(p.kazanildiTs)) + '</span></span>' +
          '<span class="right"><span class="tag ' + (kalanGun <= 7 ? 'bek' : 'ok') + '">' +
          kalanGun + ' gün</span><br><span class="sub">' + P.gunAdi(P.gunKodu(p.sonKullanmaTs)) + '</span></span></div>';
      }).join('');

    // Tamamlanan turlar: her biri "şu kadar harcadı, şu kadar aldı".
    var turlar = ((u.cuzdan && u.cuzdan.gecmisTurlar) || []).slice(0, 6).map(function (g) {
      return '<tr><td>Tur ' + g.no + '<br><span style="color:var(--muted);font-size:.74rem">' +
        P.gunAdi(P.gunKodu(g.kapanisTs)) + '</span></td>' +
        '<td class="n">' + P.tlk(g.netKurus) + '</td>' +
        '<td class="n"><b style="color:var(--ok)">' + P.tlk(g.bakiyeKurus) + '</b></td></tr>';
    }).join('');

    // Alışveriş günleri: aynı gün fişleri birleşmiş hâlde — fiş bölme kuralının
    // panelde görünür kanıtı.
    var gunler = (u.alisverisler || []).slice(0, 12).map(function (a) {
      return '<div class="item"><span><b>' + P.tlk(a.netKurus) + '</b>' +
        (a.bakiyeKurus ? ' <span class="tag ok">bakiye ' + P.tlk(a.bakiyeKurus) + '</span>' : '') +
        (a.iadeKurus ? ' <span class="tag red">iade ' + P.tlk(a.iadeKurus) + '</span>' : '') +
        '<span class="sub">' + P.gunAdi(a.gun) + ' · tur ' + a.turNo +
        (a.fis > 1 ? ' · <b>' + a.fis + ' fiş birleşti</b>' : '') +
        (a.brutKurus !== a.netKurus ? ' · brüt ' + P.tlk(a.brutKurus) : '') + '</span></span>' +
        '<span class="right">' + (a.sayildi ? '<span class="tag ok">sayıldı</span>'
          : '<span class="tag bek">alt sınır</span>') + '</span></div>';
    }).join('');

    var fisler = (u.fisler || []).slice(0, 8).map(function (r) {
      var etiket = { 'onaylandı': 'ok', 'bekliyor': 'bek', 'reddedildi': 'red' }[r.durum] || 'bek';
      return '<div class="item"><span><b>' + P.tl(r.tutar) + '</b>' +
        '<span class="sub">' + r.t + (r.no ? ' · fiş no ' + r.no : '') +
        (r.guven ? ' · güven %' + Math.round(r.guven * 100) : '') +
        (r.sebep ? '<br>' + P.esc(r.sebep) : '') + '</span></span>' +
        '<span class="right"><span class="tag ' + etiket + '">' + r.durum + '</span></span></div>';
    }).join('');

    var igler = (u.igler || []).slice(0, 8).map(function (x) {
      return '<div class="item"><span><b>' + x.tur + '</b><span class="sub">' + x.tarih + ' · ' + x.kaynak + '</span></span>' +
        '<span class="right"><span class="tag ' + (x.durum === 'onaylandı' ? 'ok' : x.durum === 'reddedildi' ? 'red' : 'bek') + '">' +
        x.durum + '</span>' + (x.bakiyeKurus ? '<br>+' + P.tlk(x.bakiyeKurus) : '') + '</span></div>';
    }).join('');

    var HAREKET_ADI = { alisveris: '🛍️', bakiye_kazanim: '🎁', bakiye_kullanim: '💳',
      instagram: '📸', iade: '↩️', olay: '•' };
    var hareket = (u.hareket || []).slice(0, 14).map(function (r) {
      return '<tr><td style="white-space:nowrap">' + (r.t || '—') + '</td>' +
        '<td>' + (HAREKET_ADI[r.tur] || '•') + ' ' + P.esc(r.not) + '</td>' +
        '<td class="n">' + (r.kurus
          ? '<b style="color:' + (r.kurus < 0 ? 'var(--marka-kirmizi)' : 'var(--ok)') + '">' +
            (r.kurus > 0 ? '+' : '') + P.tlk(r.kurus) + '</b>'
          : '') + '</td></tr>';
    }).join('');

    return '<header class="kart-bas">' +
        '<div><b>' + P.esc(u.ad) + '</b><span class="mono">' + u.kod + '</span></div>' +
        '<button class="kapat" type="button" data-kapat aria-label="Kapat">✕</button></header>' +
      '<div class="kart-govde">' +
        '<p class="kart-alt">' + rozet(u.durum) + (u.pazarlama ? ' <span class="tag ok">kampanya izinli</span>' : '') +
          (u.ig ? ' <span class="tag sil">@' + P.esc(u.ig) + '</span>' : '') +
          (u.gercek ? ' <span class="tag bek">bu cihazdaki üye</span>' : '') +
          '<br><span class="sub">Kayıt: ' + u.tarih + ' · nokta: ' + (u.nokta || '—') +
          ' · telefon: <b>+90 (5**) *** ** ' + u.kod.slice(-2) + '</b></span></p>' +

        '<dl class="tiles">' +
          kutu('Hediye bakiye', P.tlkKisa(bakiye)) +
          kutu('Son kullanma', skt ? P.gunAdi(P.gunKodu(skt.sonKullanmaTs)) : '—') +
          kutu('Bu turda', tur.alisveris + '/' + tur.uzunluk) +
          kutu('Net harcama', P.tlkKisa(harcama)) +
        '</dl>' +

        (bekleyen ? '<div class="uyari"><b>' + bekleyen + ' fiş onay bekliyor.</b> ' +
          'Onaylanan tutar alışveriş hesabına o anda işlenir.</div>' : '') +

        '<h3 class="kart-bas3">Tur ilerlemesi</h3>' +
        '<div class="seviye">' +
          '<div class="sv-ust"><b>Tur ' + tur.no + '</b>' +
            '<span class="cost">' + tur.alisveris + '/' + tur.uzunluk + ' alışveriş</span></div>' +
          '<div class="sayac">' + kutular + '</div>' +
          '<p class="sub" style="margin:.5rem 0 0">Bu turda <b>' + P.tlk(tur.netKurus) + '</b> net harcama' +
          (tur.alisveris ? ' · ortalama ' + P.tlk(tur.ortalamaKurus) : '') + '</p>' +
          (tur.kalan
            ? '<p class="sub" style="margin:.25rem 0 0"><b>' + tur.kalan + '</b> alışveriş sonra, şu anki ' +
              'harcamayla <b>' + P.tlk(tur.tahminiBakiyeKurus) + '</b> hediye bakiye kazanacak.</p>'
            : '<p class="sub" style="margin:.25rem 0 0">Tur doldu; bir sonraki kayıtta bakiye tanımlanır.</p>') +
        '</div>' +

        '<h3 class="kart-bas3">Bakiye hareketi</h3>' +
        '<div class="dokum">' +
          '<div class="dk"><span class="dk-ad">🎁 Kazanılan<small>' +
            ((u.cuzdan && u.cuzdan.gecmisTurlar.length) || 0) + ' tur + Instagram</small></span>' +
            '<span class="dk-cubuk"><i style="width:100%"></i></span><b>+' + P.tlk(kazanilan) + '</b></div>' +
          '<div class="dk eksi"><span class="dk-ad">💳 Kullanılan<small>alışverişlerde düşülen</small></span>' +
            '<span class="dk-cubuk"></span><b>-' + P.tlk(kullanilan) + '</b></div>' +
          (dolan ? '<div class="dk eksi"><span class="dk-ad">⏳ Süresi dolan<small>' +
            P.CUZDAN.gecerlilikGun + ' gün içinde kullanılmadı</small></span>' +
            '<span class="dk-cubuk"></span><b>-' + P.tlk(dolan) + '</b></div>' : '') +
          '<div class="dk toplam"><span class="dk-ad">Açık bakiye</span><span class="dk-cubuk"></span><b>' +
            P.tlk(bakiye) + '</b></div>' +
        '</div>' +
        (partiler ? '<div class="list" style="margin-top:.6rem">' + partiler + '</div>' : '') +

        (turlar ? '<h3 class="kart-bas3">Tamamlanan turlar</h3>' +
          '<div class="tw"><table class="t"><thead><tr><th>Tur</th><th class="n">Net harcama</th>' +
          '<th class="n">Kazandığı</th></tr></thead><tbody>' + turlar + '</tbody></table></div>' : '') +

        '<h3 class="kart-bas3">Alışverişler</h3>' +
        (gunler ? '<div class="list">' + gunler + '</div>' +
          '<p class="sub">Aynı gün içindeki fişler tek alışveriş sayılır ve tutarları toplanır.</p>'
          : '<p class="bosluk">Henüz alışveriş kaydı yok.</p>') +

        '<h3 class="kart-bas3">Fişler</h3>' +
        (fisler ? '<div class="list">' + fisler + '</div>'
          : '<p class="bosluk">Bu üye fiş yüklemedi; alışverişleri kasadan işlendi.</p>') +

        '<h3 class="kart-bas3">Instagram paylaşımları</h3>' +
        (igler ? '<div class="list">' + igler + '</div>'
          : '<p class="bosluk">Paylaşım kaydı yok' + (u.ig ? '.' : '; Instagram hesabı da kayıtlı değil.') + '</p>') +

        '<h3 class="kart-bas3">Hesap hareketleri</h3>' +
        (hareket ? '<div class="tw"><table class="t"><thead><tr><th>Zaman</th><th>Hareket</th><th class="n">Tutar</th></tr></thead><tbody>' +
          hareket + '</tbody></table></div>' : '<p class="bosluk">Hareket yok.</p>') +

        (u.gercek ? '<a class="btn btn-sec" href="../../kasa/">Kasa ekranında aç</a>' : '') +
      '</div>';
  }

  /* ===================== FİŞLER =====================
     Okunan fişlerin çoğu kendiliğinden sonuçlanır; buraya yalnızca yüksek
     tutarlı ve okuması netleşmeyen fişler düşer. Personelin işi bu ikisini
     ayırt etmek olduğu için ekran sadeleştirilmiştir. */
  SAYFA.fisler = {
    baslik: 'Fişler',
    ciz: function (S) {
      var hepsi = tumFisler(S);
      var bekleyen = hepsi.filter(function (x) { return x.fis.durum === 'bekliyor'; });
      var gecmis = hepsi.filter(function (x) { return x.fis.durum !== 'bekliyor'; });
      var bugun = new Date(); bugun.setHours(0, 0, 0, 0);
      var bugunku = hepsi.filter(function (x) { return x.fis.ts >= bugun.getTime(); }).length;
      var onayli = hepsi.filter(function (x) { return x.fis.durum === 'onaylandı'; });
      var ciro = onayli.reduce(function (a, x) { return a + x.fis.tutar; }, 0);
      var sayilan = onayli.filter(function (x) { return x.fis.sayildi !== false; }).length;

      return '<div class="uyari">Müşteri <b>FIS</b> yazıp fişin fotoğrafını gönderir; tutar okunur ve ' +
          'tutar alışveriş hesabına işlenir. Aynı gün içindeki fişler tek alışveriş sayılır. ' +
          'Otomatik sonuçlanmayanlar — ' +
          P.tlKisa(P.RECEIPT.kontrolUstu) + ' üstü ve okuması netleşmeyen fişler — buraya düşer.</div>' +
        '<dl class="tiles">' + kutu('Bekleyen', bekleyen.length) + kutu('Bugün gelen', bugunku) +
          kutu('Alışverişe sayılan', sayilan) + kutu('Okunan ciro', P.tlKisa(ciro)) + '</dl>' +
        (bekleyen.length
          ? '<div class="list">' + bekleyen.map(function (x) { return fisSatiri(x, true); }).join('') + '</div>'
          : '<p class="bosluk">Onay bekleyen fiş yok.<br><span style="font-size:.78rem">' +
            'Sohbette <b>FIS</b> yazıp 📎 ile fiş gönderdiğinizde buraya düşer.</span></p>') +
        (gecmis.length
          ? '<h2 style="font-size:1rem;margin:1.1rem 0 .5rem;color:var(--cocoa)">Son kararlar</h2>' +
            '<div class="tw"><table class="t"><thead><tr><th>Üye</th><th>Tutar</th><th>Durum</th></tr></thead><tbody>' +
            gecmis.slice(0, 15).map(function (x) {
              return '<tr><td>' + P.esc(x.uye.ad) + '<br><span style="color:var(--muted);font-size:.74rem">' +
                x.fis.t + '</span></td><td class="n">' + P.tl(x.fis.tutar) +
                (x.fis.durum === 'onaylandı' ? '<br><span style="color:var(--ok);font-size:.74rem">' +
                  (x.fis.sayildi === false ? 'aynı güne eklendi' : 'alışverişe sayıldı') + '</span>' : '') +
                '</td><td><span class="tag ' + (x.fis.durum === 'onaylandı' ? 'ok' : 'red') + '">' + x.fis.durum + '</span>' +
                (x.fis.sebep ? '<br><span style="color:var(--muted);font-size:.72rem">' + P.esc(x.fis.sebep) + '</span>' : '') +
                '</td></tr>';
            }).join('') + '</tbody></table></div>'
          : '') +
        '<button class="btn btn-sec" data-is="fisCsv">Fiş listesini CSV indir</button>';
    }
  };

  function fisSatiri(x, karar) {
    var f = x.fis, u = x.uye, tur = turOf(u);
    // Onaylanınca ne olacağı satırda yazıyor: personel sonucu görerek karar versin.
    var ayniGun = (u.alisverisler || []).some(function (a) {
      return a.gun === P.gunKodu(f.fisTs || f.ts) && a.sayildi;
    });
    return '<div class="item" style="align-items:flex-start">' +
      (f.gorsel ? '<img class="fis-onizleme" src="' + f.gorsel + '" alt="Fiş fotoğrafı">' : '') +
      '<span><b>' + P.tl(f.tutar) + '</b> ' +
      (karar ? '<span class="tag bek">' + (ayniGun ? 'aynı güne eklenir' : 'alışveriş ' + (tur.alisveris + 1) + '/' + tur.uzunluk) + '</span>' : '') +
      '<span class="sub">' + P.esc(u.ad) + ' · <span class="mono">' + u.kod + '</span> · ' +
      'bu turda ' + tur.alisveris + '/' + tur.uzunluk + '</span>' +
      '<span class="sub">' + f.t + ' · ' + P.esc(f.isletme || '—') +
      (f.no ? ' · fiş no ' + f.no : '') + ' · güven %' + Math.round((f.guven || 0) * 100) + '</span>' +
      (f.sebep ? '<span class="sub"><b>' + P.esc(f.sebep) + '</b></span>' : '') +
      (karar
        ? '<span class="row" style="margin-top:.5rem;display:flex;gap:.4rem">' +
          '<button class="btn btn-primary" style="width:auto;min-height:38px;padding:0 .7rem" ' +
          'data-is="fisOnay" data-kod="' + u.kod + '" data-fis="' + f.id + '">Onayla</button>' +
          '<button class="btn btn-sec" style="width:auto;min-height:38px;padding:0 .7rem" ' +
          'data-is="fisRed" data-kod="' + u.kod + '" data-fis="' + f.id + '">Reddet</button>' +
          '<button class="btn btn-sec" style="width:auto;min-height:38px;padding:0 .7rem" ' +
          'data-is="uyeKart" data-kod="' + u.kod + '">Üye kartı</button></span>'
        : '') +
      '</span></div>';
  }

  ISLER.fisOnay = function (S, b) { fisKarar(S, b.dataset.kod, b.dataset.fis, true); };
  ISLER.fisRed = function (S, b) { fisKarar(S, b.dataset.kod, b.dataset.fis, false); };

  function fisKarar(S, kod, fisId, onay) {
    var gercek = S.code === kod;
    var u = uyeler(S).filter(function (x) { return x.kod === kod; })[0];
    if (!u) return;
    // u.fisler, örnek üyede S.ornek'teki, gerçek üyede S.receipts'teki dizinin
    // kendisidir; buradaki değişiklik doğrudan duruma yazılır.
    var f = (u.fisler || []).filter(function (r) { return r.id === fisId; })[0];
    if (!f || f.durum !== 'bekliyor') return;

    if (!onay) {
      var sebep = prompt('Reddetme sebebi (müşteriye aynen gider):',
        'Fiş okunamadı, lütfen fişin tamamının göründüğü daha net bir fotoğraf gönderin.');
      if (sebep === null) return;
      f.durum = 'reddedildi';
      f.sebep = sebep.trim() || 'Personel reddetti.';
      if (gercek) mesaj(S, P.MSG.receiptRejected(f.sebep), 'Fiş: personel reddetti');
      P.audit(S, 'fis.red', P.tl(f.tutar) + ' · ' + kod);
      P.save(S); yenile();
      return;
    }

    // Onay, fişi alışveriş hesabına işler. Aynı gün zaten sayılmışsa yeni
    // alışveriş açılmaz, o günün tutarına eklenir — kural burada da geçerli.
    var tur = turOf(u);
    var ayniGun = (u.alisverisler || []).some(function (a) {
      return a.gun === P.gunKodu(f.fisTs || f.ts) && a.sayildi;
    });
    if (!confirm(P.tl(f.tutar) + ' onaylanacak ve ' + u.ad + ' üyesinin alışveriş hesabına işlenecek' +
      (ayniGun ? ' (aynı güne eklenir, alışveriş sayısı değişmez).' : ' (alışveriş ' + (tur.alisveris + 1) + '/' + tur.uzunluk + ').') +
      ' Onaylıyor musunuz?')) return;

    f.durum = 'onaylandı'; f.sebep = null;
    var r = P.alisverisEkle(u, { brutKurus: P.kurus(f.tutar), ts: f.fisTs || f.ts, kaynak: 'fis:' + f.id });
    f.sayildi = r.sayildi;

    if (gercek) {
      // Gerçek üyede cüzdan doğrudan durumun içinde; motor onu güncelledi.
      S.cuzdan = u.cuzdan; S.alisverisler = u.alisverisler;
      P.event(S, 'Alışveriş ' + P.tl(f.tutar) + ' (fiş · personel onayı)', 'fis', 0);
      mesaj(S, P.MSG.receiptApproved({ tutar: f.tutar, sayildi: r.sayildi,
        gunSayildi: !!(r.alisveris && r.alisveris.sayildi), tur: r.tur }),
        'Fiş: personel onayladı', 'puan');
      if (r.parti) {
        var g = S.cuzdan.gecmisTurlar[0];
        mesaj(S, P.MSG.cycleComplete({ netKurus: g.netKurus, bakiyeKurus: g.bakiyeKurus,
          sonKullanmaTs: r.parti.sonKullanmaTs }), 'Tur tamamlandı · hediye bakiye tanımlandı', 'puan');
      }
    } else {
      u.hareket = u.hareket || [];
      u.hareket.unshift({ ts: Date.now(), t: P.today() + ' ' + P.now(), tur: 'alisveris',
        not: 'Alışveriş ' + P.tl(f.tutar) + ' (fiş · personel onayı)', kurus: P.kurus(f.tutar) });
    }
    P.audit(S, 'fis.onay', P.tl(f.tutar) + ' · alışverişe işlendi · ' + kod);
    P.save(S); yenile();
  }

  ISLER.fisCsv = function (S) {
    var satir = [['Tarih', 'Üye kodu', 'Ad', 'İşletme', 'Fiş no', 'Tutar (TL)', 'Okuma güveni', 'Durum', 'Alışveriş sayıldı', 'Not']];
    tumFisler(S).forEach(function (x) {
      satir.push([x.fis.t, x.uye.kod, x.uye.ad, x.fis.isletme || '', x.fis.no || '',
        Number(x.fis.tutar || 0).toFixed(2).replace('.', ','),
        Math.round((x.fis.guven || 0) * 100) + '%', x.fis.durum,
        x.fis.durum === 'onaylandı' ? (x.fis.sayildi ? 'Evet' : 'Aynı güne eklendi') : '', x.fis.sebep || '']);
    });
    P.audit(S, 'fis.disa_aktarim', satir.length - 1 + ' kayıt'); P.save(S);
    csvIndir('fisler-' + P.today().replace(/\./g, '-') + '.csv', satir);
  };

  /* ===================== ÖDÜLLER ===================== */
  SAYFA.oduller = {
    baslik: 'Ödüller',
    ciz: function (S) {
      var liste = (S.rewards || []);
      function grup(tur, baslik, aciklama) {
        var g = liste.filter(function (r) { return (r.tur || 'urun') === tur; });
        if (!g.length) return '';
        return '<h2 style="font-size:1rem;margin:1.1rem 0 .35rem;color:var(--cocoa)">' + baslik + '</h2>' +
          '<p class="sub" style="margin:0 0 .5rem;font-size:.78rem;color:var(--muted)">' + aciklama + '</p>' +
          '<div class="list">' + g.map(function (r) {
            return '<div class="item"><span><b>' + P.esc(P.rewardLabel(r)) + '</b>' +
              '<span class="sub">' + r.bedel + ' puan' + (r.tur === 'yuzde' ? ' · tek alışverişte geçerli' : '') + '</span></span>' +
              '<span class="right"><button class="btn btn-sec" style="width:auto;min-height:38px;padding:0 .7rem" ' +
              'data-is="odulDurum" data-id="' + r.id + '">' + (r.aktif ? 'Pasife al' : 'Aktif et') + '</button></span></div>';
          }).join('') + '</div>';
      }
      return '<div class="uyari"><b>Bu mekanizma şu anda kapalı.</b> Onaylanan modelde tek ödül ' +
          '<b>hediye bakiye</b>: müşteri ' + P.CUZDAN.turUzunlugu + ' alışverişini tamamlayınca ' +
          'harcamasının %' + Math.round(P.CUZDAN.oran * 100) + "'i kadar bakiye kazanıyor. " +
          'Katalog açılırsa müşteri iki ayrı birim (puan ve bakiye) taşımak zorunda kalır ve kasada ' +
          '"hangisi geçerli" tartışması çıkar. İkinci aşamada devreye alınmak üzere burada duruyor.</div>' +
        grup('urun', 'Ürün ödülleri', 'Puan karşılığı verilen ürün.') +
        grup('yuzde', 'Yüzde indirimi', 'Kademeli indirim: puan arttıkça oran yükselir.') +
        '<form class="form" id="yeni"><h3>Yeni ödül</h3>' +
          '<label>Tür<select id="tur">' +
            '<option value="urun">Ürün ödülü</option>' +
            '<option value="yuzde">Yüzde indirimi</option></select></label>' +
          '<label id="l-ad">Ödül adı<input id="ad" maxlength="60" placeholder="Limonata"></label>' +
          '<label id="l-yuzde" hidden>İndirim oranı (%)<input id="yuzde" type="number" min="1" max="50" value="5"></label>' +
          '<label>Puan bedeli<input id="bedel" type="number" min="1" max="1000" required value="8"></label>' +
          '<button class="btn btn-primary">Ödülü ekle</button></form>';
    },
    bagla: function () {
      var tur = document.getElementById('tur');
      function turDegisti() {
        var yuzdeMi = tur.value === 'yuzde';
        document.getElementById('l-ad').hidden = yuzdeMi;
        document.getElementById('l-yuzde').hidden = !yuzdeMi;
      }
      tur.addEventListener('change', turDegisti); turDegisti();
      document.getElementById('yeni').addEventListener('submit', function (e) {
        e.preventDefault();
        var S = P.load(), yuzdeMi = tur.value === 'yuzde';
        var ad = document.getElementById('ad').value.trim();
        var yuzde = parseInt(document.getElementById('yuzde').value, 10);
        var bedel = parseInt(document.getElementById('bedel').value, 10);
        if (!(bedel >= 1 && bedel <= 1000)) return;
        if (yuzdeMi) {
          if (!(yuzde >= 1 && yuzde <= 50)) return;
          ad = '%' + yuzde + ' indirim';
        } else if (!ad) return;
        S.rewards.push({ id: Date.now(), ad: ad, bedel: bedel, aktif: true,
          tur: yuzdeMi ? 'yuzde' : 'urun', yuzde: yuzdeMi ? yuzde : undefined });
        P.audit(S, 'odul.eklendi', ad + ' · ' + bedel + ' puan'); P.save(S); yenile();
      });
    }
  };
  ISLER.odulDurum = function (S, b) {
    var r = S.rewards.filter(function (x) { return String(x.id) === b.dataset.id; })[0];
    if (!r) return;
    r.aktif = !r.aktif;
    P.audit(S, 'odul.' + (r.aktif ? 'aktif' : 'pasif'), P.rewardLabel(r)); P.save(S); yenile();
  };

  /* ===================== KAMPANYALAR ===================== */
  function kampanyaSatir(k) {
    var rozetler = { taslak: ['bek', 'taslak'], gonderiliyor: ['bek', 'gönderiliyor'],
      tamam: ['ok', 'tamamlandı'], iptal: ['sil', 'iptal'] };
    var r = rozetler[k.durum] || ['sil', k.durum];
    var sag = k.durum === 'taslak'
      ? '<button class="btn btn-primary" style="width:auto;min-height:38px;padding:0 .7rem" data-is="kampanyaBaslat" data-id="' + k.id + '">Gönder</button>'
      : '<span class="tag ' + r[0] + '">' + r[1] + '</span><br>' +
        '<span style="font-size:.74rem;color:var(--muted)">' + k.gonderildi + ' gitti · ' +
        k.atlandi + ' atlandı' + (k.hata ? ' · <b style="color:var(--marka-kirmizi)">' + k.hata + ' hata</b>' : '') + '</span>';
    return '<div class="item"><span><b>' + P.esc(k.ad) + '</b>' +
      '<span class="sub"><code>' + k.sablon + '</code> · ' + k.olusturma +
      (k.alici ? ' · ' + k.alici + ' alıcı' : '') + '</span>' +
      (k.hata ? '<button class="btn btn-sec" style="width:auto;min-height:34px;padding:0 .6rem;margin-top:.4rem;font-size:.75rem" ' +
        'data-is="kampanyaYeniden" data-id="' + k.id + '">' + k.hata + ' başarısız alıcıyı yeniden dene</button>' : '') +
      '</span><span class="right">' + sag + '</span></div>';
  }

  SAYFA.kampanyalar = {
    baslik: 'Kampanyalar',
    ciz: function (S) {
      var izinli = uyeler(S).filter(function (x) { return x.durum === 'active' && x.pazarlama; });
      var birim = 0.45;
      return '<div class="uyari">WhatsApp, işletmenin başlattığı pazarlama mesajına yalnızca ' +
          '<b>Meta onaylı MARKETING şablonuyla</b> izin verir; serbest metin reddedilir.</div>' +
        '<dl class="tiles">' + kutu('İzinli üye', izinli.length) +
          kutu('Tahmini tutar', (izinli.length * birim).toFixed(2).replace('.', ',') + ' TL') + '</dl>' +
        (S.campaigns.length ? '<div class="list">' + S.campaigns.map(kampanyaSatir).join('') + '</div>' : '') +
        '<form class="form" id="yeni"><h3>Yeni kampanya</h3>' +
          '<label>Kampanya adı<input id="ad" required maxlength="60" placeholder="Ekim kahve kampanyası"></label>' +
          '<label>Onaylı şablon adı<input id="sablon" required pattern="[a-z0-9_]+" value="ekim_kampanya"></label>' +
          '<button class="btn btn-primary">Taslak oluştur</button>' +
          '<p style="font-size:.78rem;color:var(--muted);margin:.6rem 0 0">Taslak alıcı listesini dondurur ve ' +
          'hiçbir mesaj göndermez. Gönderim anında izni geri almış üye atlanır.</p></form>';
    },
    bagla: function () {
      document.getElementById('yeni').addEventListener('submit', function (e) {
        e.preventDefault();
        var S = P.load(), ad = document.getElementById('ad').value.trim();
        var sablon = document.getElementById('sablon').value.trim();
        if (!ad || !sablon) return;
        var izinli = uyeler(S).filter(function (x) { return x.durum === 'active' && x.pazarlama; }).length;
        S.campaigns.unshift({ id: Date.now(), ad: ad, sablon: sablon, durum: 'taslak',
          alici: izinli, gonderildi: 0, atlandi: 0, hata: 0, olusturma: P.today() });
        P.audit(S, 'kampanya.taslak', ad + ' · ' + izinli + ' alıcı'); P.save(S); yenile();
      });
    }
  };
  ISLER.kampanyaYeniden = function (S, b) {
    var k = S.campaigns.filter(function (x) { return String(x.id) === b.dataset.id; })[0];
    if (!k || !k.hata) return;
    var n = k.hata;
    k.gonderildi += n; k.hata = 0;   // gönderilmiş alıcıya ikinci mesaj gitmez
    P.audit(S, 'kampanya.yeniden_deneme', k.ad + ' · ' + n + ' alıcı'); P.save(S);
    alert(n + ' başarısız alıcı yeniden sıraya alındı ve gönderildi. Gönderilmiş alıcılara dokunulmadı.');
    yenile();
  };

  ISLER.kampanyaBaslat = function (S, b) {
    var k = S.campaigns.filter(function (x) { return String(x.id) === b.dataset.id; })[0];
    if (!k || k.durum !== 'taslak') return;
    if (!confirm(k.alici + ' üyeye kampanya mesajı gidecek. Onaylıyor musunuz?')) return;
    // Gönderim anında izin yeniden kontrol edilir: DUR yazan atlanır.
    var gercekIzinli = S.status === 'active' && S.marketing;
    k.gonderildi = k.alici; k.atlandi = 0; k.durum = 'tamam';
    if (gercekIzinli) {
      mesaj(S, 'Peçko Fırın’nden haber var! 🎂 Bu hafta tüm kahvelerde ikinci fincan bizden. ' +
        'Kodunuzu kasada söylemeniz yeterli.\n\nÇıkmak için DUR yazın.', 'Kampanya gönderimi: ' + k.ad);
    } else if (S.status === 'active') {
      k.gonderildi -= 1; k.atlandi += 1;
    }
    P.audit(S, 'kampanya.gonderildi', k.ad + ' · ' + k.gonderildi + ' mesaj'); P.save(S);
    alert(k.gonderildi + ' mesaj gönderildi' + (k.atlandi ? ', ' + k.atlandi + ' üye atlandı (izin yok)' : '') + '.');
    yenile();
  };

  /* ===================== INSTAGRAM ===================== */
  SAYFA.instagram = {
    baslik: 'Instagram',
    ciz: function (S) {
      var bek = (S.claims || []).filter(function (c) { return c.durum === 'bekliyor'; });
      var gecmis = (S.claims || []).filter(function (c) { return c.durum !== 'bekliyor'; });
      return '<div class="uyari">Kayıtlı hesabı olan üyenin etiketli paylaşımı <b>otomatik</b> eşleşir ve ' +
          'puan eklenir. Buraya yalnızca eşleşmeyenler ve gizli hesaplar düşer.</div>' +
        (bek.length ? '<div class="list">' + bek.map(function (c) {
          return '<div class="item"><span><b>' + P.esc(c.kullanici) + '</b>' +
            '<span class="sub">' + c.tur + ' · ' + c.kaynak + ' · ' + c.tarih + '</span></span>' +
            '<span class="right">' +
            '<button class="btn btn-primary" style="width:auto;min-height:38px;padding:0 .6rem" data-is="igOnay" data-id="' + c.id + '">Onayla</button> ' +
            '<button class="btn btn-sec" style="width:auto;min-height:38px;padding:0 .6rem" data-is="igRed" data-id="' + c.id + '">Reddet</button>' +
            '</span></div>';
        }).join('') + '</div>' : '<p class="bosluk">Onay bekleyen paylaşım yok.<br><span style="font-size:.78rem">' +
          'Kasa ekranındaki “Instagram paylaşımı geldi” düğmesiyle deneyebilirsiniz.</span></p>') +
        (gecmis.length ? '<h2 style="font-size:1rem;margin:1.1rem 0 .5rem;color:var(--cocoa)">Geçmiş</h2>' +
          '<div class="list">' + gecmis.map(function (c) {
            return '<div class="item"><span><b>' + P.esc(c.kullanici) + '</b><span class="sub">' + c.tarih + '</span></span>' +
              '<span class="right"><span class="tag ' + (c.durum === 'onaylandı' ? 'ok' : 'red') + '">' + c.durum + '</span></span></div>';
          }).join('') + '</div>' : '');
    }
  };
  ISLER.igOnay = function (S, b) {
    var c = S.claims.filter(function (x) { return String(x.id) === b.dataset.id; })[0];
    if (!c || c.durum !== 'bekliyor') return;
    c.durum = 'onaylandı';
    if (S.status === 'active') {
      var kurus = c.bakiyeKurus || P.kurus(c.tur === 'gönderi' ? P.IG.postTl : P.IG.storyTl);
      var parti = P.bakiyeVer(S, kurus, 'instagram');
      c.bakiyeKurus = kurus;
      P.event(S, 'Instagram bonusu +' + P.tlk(kurus), 'instagram', 0);
      mesaj(S, 'Instagram ' + (c.tur === 'gönderi' ? 'gönderiniz' : 'hikayeniz') + ' onaylandı, *' +
        P.tlk(kurus) + '* hediye bakiye kazandınız! 🎉\nToplam bakiyeniz: *' + P.tlk(P.aktifBakiye(S)) +
        '* · son kullanma ' + P.gunAdi(P.gunKodu(parti.sonKullanmaTs)), 'Instagram: personel onayladı');
    }
    P.audit(S, 'instagram.onay', c.kullanici + ' · +' + P.tlk(c.bakiyeKurus)); P.save(S); yenile();
  };
  ISLER.igRed = function (S, b) {
    var c = S.claims.filter(function (x) { return String(x.id) === b.dataset.id; })[0];
    if (!c || c.durum !== 'bekliyor') return;
    c.durum = 'reddedildi';
    mesaj(S, 'Instagram paylaşımınızı maalesef onaylayamadık: hesabımızın etiketi görünmüyor. ' +
      'Etiketin göründüğü bir ekran görüntüsüyle tekrar deneyebilirsiniz.', 'Instagram: personel reddetti');
    P.audit(S, 'instagram.red', c.kullanici); P.save(S); yenile();
  };

  /* ===================== RAPOR =====================
     Sahibin takip etmek isteyeceği dört soru: ciro ne, bakiyenin maliyeti ne,
     kampanya işe yarıyor mu (tur tamamlama), ve kasada ne kadar yükümlülük var. */
  function donemler(S) {
    var ad = ['Bu hafta', 'Geçen hafta', 'İki hafta önce', 'Üç hafta önce'];
    var uyeListe = uyeler(S);
    return ad.map(function (etiket, i) {
      var bas = i * 7, son = bas + 7;
      var icinde = function (ts) {
        var g = Math.floor((Date.now() - ts) / 86400000);
        return g >= bas && g < son;
      };
      var r = { etiket: etiket, uye: 0, alisveris: 0, netKurus: 0, bakiyeKullanilan: 0,
        iade: 0, tur: 0, kazanilan: 0, fis: 0 };
      uyeListe.forEach(function (u) {
        (u.alisverisler || []).forEach(function (a) {
          if (!icinde(a.ts)) return;
          if (a.sayildi) r.alisveris++;
          r.netKurus += a.netKurus; r.bakiyeKullanilan += a.bakiyeKurus; r.iade += a.iadeKurus;
        });
        ((u.cuzdan && u.cuzdan.gecmisTurlar) || []).forEach(function (t) {
          if (icinde(t.kapanisTs)) { r.tur++; r.kazanilan += t.bakiyeKurus; }
        });
        (u.fisler || []).forEach(function (f) {
          if (f.durum === 'onaylandı' && icinde(f.ts)) r.fis++;
        });
        var gf = gunFarki(u.tarih);
        if (gf !== null && gf >= bas && gf < son) r.uye++;
      });
      return r;
    });
  }
  function gunFarki(gg) {
    var m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(gg || ''));
    if (!m) return null;
    var t = new Date(+m[3], +m[2] - 1, +m[1]);
    return Math.floor((Date.now() - t.getTime()) / 86400000);
  }

  SAYFA.rapor = {
    baslik: 'Rapor',
    ciz: function (S) {
      var d = donemler(S);
      var g = gunlukOzet(S, 30);
      // Kampanyanın gerçek maliyeti: verilen bakiyenin cirodaki payı.
      var maliyet = g.netKurus ? (g.kazanilan / g.netKurus) * 100 : 0;
      var kullanimOrani = g.kazanilan ? (g.bakiyeKullanilan / g.kazanilan) * 100 : 0;
      return '<div class="uyari">Örnek veriyle doldurulmuştur; <b>bu cihazdaki gerçek akış</b> ' +
          'sayılara dahildir. Gerçek panelde dönem gün/hafta/ay olarak seçilir.</div>' +
        '<dl class="tiles">' +
          kutu('30 günde ciro', P.tlkKisa(g.netKurus)) +
          kutu('30 günde alışveriş', g.alisveris) +
          kutu('Tamamlanan tur', g.tur) +
          kutu('Tanımlanan bakiye', P.tlkKisa(g.kazanilan)) +
        '</dl>' +
        '<div class="form"><h3>Kampanyanın maliyeti</h3>' +
          '<div class="dokum">' +
            '<div class="dk"><span class="dk-ad">Tanımlanan bakiye<small>son 30 gün</small></span>' +
              '<span class="dk-cubuk"><i style="width:100%"></i></span><b>' + P.tlk(g.kazanilan) + '</b></div>' +
            '<div class="dk"><span class="dk-ad">Kullanılan bakiye<small>kasada düşülen</small></span>' +
              '<span class="dk-cubuk"><i style="width:' + Math.min(100, Math.round(kullanimOrani)) + '%"></i></span>' +
              '<b>' + P.tlk(g.bakiyeKullanilan) + '</b></div>' +
            '<div class="dk toplam"><span class="dk-ad">Ciroya oranı</span><span class="dk-cubuk"></span><b>%' +
              maliyet.toFixed(2).replace('.', ',') + '</b></div>' +
          '</div>' +
          '<p class="sub" style="margin:.6rem 0 0">Teorik üst sınır %' +
          (P.CUZDAN.oran * 100).toFixed(0) + '. Gerçekleşen oran bunun altında kalır: ' +
          'turunu tamamlamayan üyeler ve süresi dolan bakiyeler maliyeti düşürür. ' +
          'Kullanım oranı %' + kullanimOrani.toFixed(0) + ' — kalanı ' + P.CUZDAN.gecerlilikGun +
          ' gün içinde kullanılmazsa işletmede kalır.</p></div>' +

        '<h2 style="font-size:1rem;margin:1.2rem 0 .5rem;color:var(--cocoa)">Haftalık</h2>' +
        '<div class="tw"><table class="t"><thead><tr><th>Dönem</th><th class="n">Yeni üye</th>' +
        '<th class="n">Alışveriş</th><th class="n">Ciro</th><th class="n">Tur</th>' +
        '<th class="n">Bakiye</th><th class="n">Fiş</th></tr></thead><tbody>' +
        d.map(function (r) {
          return '<tr><td>' + r.etiket + '</td><td class="n">' + r.uye + '</td><td class="n">' + r.alisveris +
            '</td><td class="n">' + P.tlkKisa(r.netKurus) + '</td><td class="n">' + r.tur +
            '</td><td class="n">' + P.tlkKisa(r.kazanilan) + '</td><td class="n">' + r.fis + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        turDagilimi(S) +
        '<h2 style="font-size:1rem;margin:1.2rem 0 .5rem;color:var(--cocoa)">Nokta bazlı okutma</h2>' +
        '<div class="tw"><table class="t"><thead><tr><th>Nokta</th><th class="n">QR</th><th class="n">NFC</th><th class="n">Toplam</th></tr></thead><tbody>' +
        (S.cards || []).map(function (c) {
          return '<tr><td>' + c.etiket + ' <code>' + c.token + '</code>' +
            (c.aktif ? '' : ' <span class="tag sil">pasif</span>') + '</td><td class="n">' + c.qr +
            '</td><td class="n">' + c.nfc + '</td><td class="n">' + (c.qr + c.nfc) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<button class="btn btn-sec" data-is="raporCsv">Raporu CSV indir</button>';
    }
  };

  /* Tur hunisi: üyeler turun neresinde takılıyor. Kampanyanın işe yarayıp
     yaramadığı buradan okunur — 10 uzun geliyorsa yığılma ortada görünür. */
  function turDagilimi(S) {
    var aktif = uyeler(S).filter(function (x) { return x.durum === 'active'; });
    var kova = [
      { ad: '0 alışveriş', alt: 0, ust: 0, adet: 0 },
      { ad: '1-3 alışveriş', alt: 1, ust: 3, adet: 0 },
      { ad: '4-6 alışveriş', alt: 4, ust: 6, adet: 0 },
      { ad: '7-9 alışveriş', alt: 7, ust: 9, adet: 0 },
      { ad: 'Tur doldu', alt: 10, ust: 99, adet: 0 }
    ];
    var bakiyeli = 0, yukumluluk = 0, turToplam = 0;
    aktif.forEach(function (u) {
      var t = turOf(u);
      for (var i = 0; i < kova.length; i++) {
        if (t.alisveris >= kova[i].alt && t.alisveris <= kova[i].ust) { kova[i].adet++; break; }
      }
      var b = bakiyeOf(u);
      if (b > 0) { bakiyeli++; yukumluluk += b; }
      turToplam += ((u.cuzdan && u.cuzdan.gecmisTurlar) || []).length;
    });
    var enBuyuk = kova.reduce(function (a, k) { return Math.max(a, k.adet); }, 1);
    return '<h2 style="font-size:1rem;margin:1.2rem 0 .5rem;color:var(--cocoa)">Tur dağılımı</h2>' +
      '<div class="dokum">' +
        kova.map(function (k) {
          return '<div class="dk"><span class="dk-ad">' + k.ad + '</span>' +
            '<span class="dk-cubuk"><i style="width:' + Math.round((k.adet / enBuyuk) * 100) + '%"></i></span>' +
            '<b style="color:var(--cocoa)">' + k.adet + '</b></div>';
        }).join('') +
        '<div class="dk toplam"><span class="dk-ad">Bakiyesi olan üye</span><span class="dk-cubuk"></span><b>' +
          bakiyeli + '</b></div>' +
      '</div>' +
      '<p class="sub" style="margin:.6rem 0 0">Bugüne kadar <b>' + turToplam + '</b> tur tamamlandı. ' +
      'Açık bakiye yükümlülüğü: <b>' + P.tlk(yukumluluk) + '</b>.</p>';
  }

  ISLER.raporCsv = function (S) {
    function tl(k) { return (k / 100).toFixed(2).replace('.', ','); }
    var satir = [['Dönem', 'Yeni üye', 'Alışveriş', 'Net ciro (TL)', 'Kullanılan bakiye (TL)',
      'İade (TL)', 'Tamamlanan tur', 'Tanımlanan bakiye (TL)', 'Okunan fiş']];
    donemler(S).forEach(function (r) {
      satir.push([r.etiket, r.uye, r.alisveris, tl(r.netKurus), tl(r.bakiyeKullanilan),
        tl(r.iade), r.tur, tl(r.kazanilan), r.fis]);
    });
    satir.push([]);
    satir.push(['Açık bakiye yükümlülüğü (TL)', tl(acikYukumluluk(S))]);
    satir.push([]);
    satir.push(['Nokta', 'QR okutma', 'NFC okutma', 'Toplam']);
    (S.cards || []).forEach(function (c) { satir.push([c.etiket + ' (' + c.token + ')', c.qr, c.nfc, c.qr + c.nfc]); });
    P.audit(S, 'rapor.disa_aktarim', donemler(S).length + ' dönem'); P.save(S);
    csvIndir('pecko-rapor-' + P.today().replace(/\./g, '-') + '.csv', satir);
  };

  /* ===================== QR / NFC ===================== */
  SAYFA.qr = {
    baslik: 'QR / NFC',
    ciz: function (S) {
      var kok = location.origin + location.pathname.replace(/panel\/qr\/$/, '');
      return '<div class="uyari">QR ve NFC üretimi yalnızca yönetimdedir. Etiketi yazdıktan sonra ' +
          '<b>kilitleyin</b>: kilitlenmemiş etiket başka bir adrese yeniden yazılabilir.</div>' +
        (S.cards || []).map(function (c, i) {
          return '<div class="qrbox"><b>' + c.etiket + '</b> <code style="display:inline">' + c.token + '</code>' +
            '<div id="qr' + i + '" style="margin:.6rem auto"></div>' +
            '<code>' + kok + '?nokta=' + c.token + '</code>' +
            '<p style="font-size:.76rem;color:var(--muted);margin:.5rem 0 0">NFC durumu: <b>' + c.nfcDurum + '</b> · ' +
            'okutma: QR ' + c.qr + ' · NFC ' + c.nfc + '</p></div>';
        }).join('') +
        '<p style="font-size:.78rem;color:var(--muted)">Gerçek panelde ayrıca 9×13 cm baskı sayfası ve ' +
        'Android Chrome ile etiket yaz / doğrula / kilitle adımları var.</p>';
    },
    bagla: function (S) {
      var kok = location.origin + location.pathname.replace(/panel\/qr\/$/, '');
      (S.cards || []).forEach(function (c, i) {
        var el = document.getElementById('qr' + i);
        if (w.QRCode) { new w.QRCode(el, { text: kok + '?nokta=' + c.token, width: 190, height: 190,
          colorDark: '#3B2622', colorLight: '#ffffff' }); }
        else el.innerHTML = '<p style="font-size:.8rem;color:var(--muted)">QR görseli yüklenemedi; adres aşağıda.</p>';
      });
    }
  };

  /* ===================== İYS ===================== */
  SAYFA.iys = {
    baslik: 'İYS',
    ciz: function (S) {
      var kuyruk = iysKuyruk(S);
      var bekleyen = kuyruk.filter(function (r) { return !r.aktarim; });
      var gecikmis = bekleyen.filter(function (r) { return r.gecikmis; });
      return '<div class="uyari">Kampanya izni veren, iznini geri alan ve üyeliğini silen her müşteri ' +
          'için bir kayıt kuyruğa girer. Mevzuat <b>3 iş günü</b> içinde bildirim ister.</div>' +
        (gecikmis.length ? '<div class="err" style="margin-bottom:.9rem"><b>' + gecikmis.length +
          ' kayıt yasal süreyi aştı.</b> En eskisi ' + gecikmis[0].tarih +
          ' tarihli; en kısa sürede aktarın.</div>' : '') +
        '<dl class="tiles">' + kutu('Bekleyen', bekleyen.length) + kutu('Aktarılmış', kuyruk.length - bekleyen.length) + '</dl>' +
        (kuyruk.length ? '<div class="tw"><table class="t"><thead><tr><th>Alıcı</th><th>Tür</th><th>Kaynak</th><th>Durum</th></tr></thead><tbody>' +
          kuyruk.map(function (r) {
            return '<tr><td style="white-space:nowrap">' + r.alici + '</td><td>' +
              '<span class="tag ' + (r.tur === 'ONAY' ? 'ok' : 'red') + '">' + r.tur + '</span></td><td>' +
              r.kaynak + '<br><span style="color:var(--muted);font-size:.74rem">' + r.tarih + '</span></td><td>' +
              (r.aktarim ? '<span class="tag ok">aktarıldı</span>'
                : r.gecikmis ? '<span class="tag red">gecikmiş</span>' : '<span class="tag bek">bekliyor</span>') +
              '</td></tr>';
          }).join('') + '</tbody></table></div>' : '<p class="bosluk">Kuyrukta kayıt yok. ' +
          'Sohbette <b>KAMPANYA EVET</b> yazarak deneyebilirsiniz.</p>') +
        (bekleyen.length ? '<button class="btn btn-primary" data-is="iysAktar">' + bekleyen.length +
          ' kaydı dışa aktar (CSV)</button>' : '');
    }
  };
  function iysKuyruk(S) {
    var out = (S.iys || []).slice();
    if (S.status === 'active' && S.marketing && !out.some(function (r) { return r.kaynak === 'onay sayfası'; })) {
      out.unshift({ alici: '+905321234567', tur: 'ONAY', kaynak: 'onay sayfası',
        tarih: S.activatedAt || P.today(), aktarim: false });
    }
    return out;
  }
  ISLER.iysAktar = function (S) {
    var kuyruk = iysKuyruk(S).filter(function (r) { return !r.aktarim; });
    var satir = [['alici', 'tip', 'tur', 'kaynak', 'izin_tarihi', 'durum']];
    kuyruk.forEach(function (r) { satir.push([r.alici, 'BIREYSEL', 'MESAJ', r.kaynak, r.tarih, r.tur]); });
    S.iys = kuyruk.map(function (r) { r.aktarim = true; return r; });
    P.audit(S, 'iys.aktarim', kuyruk.length + ' kayıt'); P.save(S);
    csvIndir('iys-' + P.today().replace(/\./g, '-') + '.csv', satir);
    yenile();
  };

  /* ===================== PERSONEL ===================== */
  SAYFA.personel = {
    baslik: 'Personel',
    ciz: function (S) {
      return '<div class="uyari">Vardiyada kim olduğu girişte seçilir; her işlem o kişinin adıyla ' +
          'denetim kaydına yazılır. “Bu ödülü kim verdi?” sorusunun cevabı budur.</div>' +
        '<div class="list">' + (S.staff || []).map(function (k) {
          return '<div class="item"><span><b>' + P.esc(k.ad) + '</b><span class="sub">' +
            (k.aktif ? 'aktif' : 'pasif') + (S.shift === k.ad ? ' · vardiyada' : '') + '</span></span>' +
            '<span class="right">' +
            (k.aktif ? '<button class="btn btn-sec" style="width:auto;min-height:38px;padding:0 .6rem" data-is="vardiya" data-ad="' + P.esc(k.ad) + '">Vardiyaya al</button> ' : '') +
            '<button class="btn btn-sec" style="width:auto;min-height:38px;padding:0 .6rem" data-is="personelDurum" data-id="' + k.id + '">' +
            (k.aktif ? 'Pasife al' : 'Aktif et') + '</button></span></div>';
        }).join('') + '</div>' +
        '<form class="form" id="yeni"><h3>Personel ekle</h3>' +
          '<label>Ad<input id="ad" required maxlength="40" placeholder="Selin"></label>' +
          '<button class="btn btn-primary">Ekle</button></form>' +
        '<div class="form"><h3>Açık oturumlar</h3>' +
          '<p style="font-size:.84rem;margin:0 0 .6rem">1 oturum açık · bu cihaz · son işlem ' + P.now() + '</p>' +
          '<button class="btn btn-sec" data-is="oturumKapat">Bu cihaz dışındaki tüm oturumları kapat</button></div>';
    },
    bagla: function () {
      document.getElementById('yeni').addEventListener('submit', function (e) {
        e.preventDefault();
        var S = P.load(), ad = document.getElementById('ad').value.trim();
        if (!ad) return;
        S.staff.push({ id: Date.now(), ad: ad, aktif: true });
        P.audit(S, 'personel.eklendi', ad); P.save(S); yenile();
      });
    }
  };
  ISLER.vardiya = function (S, b) { S.shift = b.dataset.ad; P.audit(S, 'vardiya', b.dataset.ad); P.save(S); yenile(); };
  ISLER.personelDurum = function (S, b) {
    var k = S.staff.filter(function (x) { return String(x.id) === b.dataset.id; })[0];
    if (!k) return;
    k.aktif = !k.aktif;
    if (!k.aktif && S.shift === k.ad) S.shift = null;
    P.audit(S, 'personel.' + (k.aktif ? 'aktif' : 'pasif'), k.ad); P.save(S); yenile();
  };
  ISLER.oturumKapat = function (S) { P.audit(S, 'oturum.kapatildi', '0 oturum'); P.save(S); alert('Bu cihaz dışında açık oturum yok.'); };

  /* ===================== DENETİM ===================== */
  SAYFA.denetim = {
    baslik: 'Denetim kaydı',
    ciz: function (S) {
      var k = S.audit || [];
      return '<div class="uyari">Silme, düzeltme, numara gösterme, dışa aktarma ve kampanya adımlarının ' +
          'tamamı kim ve ne zaman bilgisiyle kaydedilir.</div>' +
        (k.length ? '<div class="tw"><table class="t"><thead><tr><th>Zaman</th><th>Kim</th><th>İşlem</th></tr></thead><tbody>' +
          k.map(function (r) {
            return '<tr><td style="white-space:nowrap">' + r.t + '</td><td>' + P.esc(r.kim) + '</td><td>' +
              '<b>' + r.islem + '</b>' + (r.detay ? '<br><span style="color:var(--muted)">' + P.esc(r.detay) + '</span>' : '') + '</td></tr>';
          }).join('') + '</tbody></table></div>'
          : '<p class="bosluk">Henüz kayıt yok. Panelde bir işlem yapın.</p>');
    }
  };

  w.PANEL = PANEL;
})(window);
