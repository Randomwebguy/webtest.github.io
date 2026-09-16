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
  var MOCK = 7;

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
     Önce hareketler üretilir, puan bakiyesi ve harcama bunlardan hesaplanır:
     üye kartındaki "hangi puan nereden geldi" dökümü toplamla birebir uyuşsun.
     Fiş puanı, o anki harcamanın karşılığı olan seviye çarpanıyla verilir —
     gerçek sistemdeki sıra da budur. */
  function uyeKur(k, i) {
    var ziyaret = k[5], fisAdet = k[6], ort = k[7], igAdet = k[8], hedefBakiye = k[9];
    var rnd = tohumlu(i * 977 + 13);
    var ledger = [], fisler = [], igler = [];
    var harcama = 0, n, g, puan, tur;

    function zaman(gunOnce, sira) {
      return gun(gunOnce) + ' ' + ('0' + (9 + (sira % 11))).slice(-2) + ':' + ('0' + ((sira * 17) % 60)).slice(-2);
    }
    function yaz(gunOnce, sira, t, p, metin) {
      ledger.push({ ts: Date.now() - gunOnce * 86400000, t: zaman(gunOnce, sira), tur: t, puan: p, not: metin });
    }

    // Fişler eskiden yeniye işlenir ki çarpan o günkü seviyeye göre uygulansın.
    var gunler = [];
    for (n = 0; n < fisAdet; n++) gunler.push(1 + Math.floor(rnd() * 330));
    gunler.sort(function (a, b) { return b - a; });
    gunler.forEach(function (gunOnce, sira) {
      var tutar = Math.round(ort * (0.6 + rnd() * 0.8) * 100) / 100;
      var p = P.puanFor(tutar, P.tierForSpend(harcama).carpan);
      harcama += tutar;
      fisler.push({ id: 'F' + i + '-' + sira, ts: Date.now() - gunOnce * 86400000, t: zaman(gunOnce, sira),
        tutar: tutar, no: String(100000 + Math.floor(rnd() * 899999)), fisTarih: zaman(gunOnce, sira),
        isletme: 'PEÇKO FIRIN', guven: Math.round((0.9 + rnd() * 0.09) * 100) / 100,
        durum: 'onaylandı', puan: p, sebep: null });
      yaz(gunOnce, sira, 'fis', p, 'Fiş +' + p + ' (' + P.tl(tutar) + ')');
    });

    for (n = 0; n < ziyaret; n++) {
      g = 1 + Math.floor(rnd() * 200);
      yaz(g, n, 'ziyaret', 1, 'Puan +1 (ziyaret)');
    }

    for (n = 0; n < igAdet; n++) {
      g = 3 + Math.floor(rnd() * 120);
      tur = n % 3 === 2 ? 'gönderi' : 'hikaye';
      puan = tur === 'gönderi' ? P.IG.post : P.IG.story;
      igler.push({ tur: tur, tarih: zaman(g, n), durum: 'onaylandı', puan: puan,
        kaynak: k[3] ? 'otomatik eşleşme' : 'ekran görüntüsü' });
      yaz(g, n, 'instagram', puan, 'Bonus +' + puan + ' (Instagram ' + tur + ')');
    }

    // Ödüller: üye biriken puanı harcar, elinde hedeflenen bakiye kalır. Puanı
    // hiç harcamayan bir üye gerçekçi değil — çok kazanan çok ödül alır.
    var kazanilan = ledger.reduce(function (a, r) { return a + r.puan; }, 0);
    var bedeller = [[5, 'Kurabiye'], [10, '1 adet hediye kahve'], [10, '%5 indirim'],
      [16, 'Dilim yaş pasta'], [20, '%10 indirim'], [35, '%15 indirim']];
    var harcanan = 0, verilen = 0;
    while (verilen < 60) {
      var o = bedeller[Math.floor(rnd() * bedeller.length)];
      if (kazanilan - harcanan - o[0] < hedefBakiye) break;
      harcanan += o[0]; verilen++;
      g = 2 + Math.floor(rnd() * 200);
      yaz(g, verilen, 'odul', -o[0], 'Ödül -' + o[0] + ' (' + o[1] + ')');
    }

    ledger.sort(function (a, b) { return b.ts - a.ts; });
    fisler.reverse();
    // Döküm tam geçmişten hesaplanır; aşağıdaki "son hareketler" listesi kırpılır.
    return {
      kod: P.newCode(), ad: k[0], durum: k[1], pazarlama: k[2], ig: k[3], nokta: k[4],
      puan: kazanilan - harcanan, odul: verilen,
      kaynak: dokumHesapla(ledger),
      fisler: fisler, igler: igler, ledger: ledger.slice(0, 24),
      // Kayıt tarihi uydurulmaz: ilk hareketten birkaç gün öncesi. Hiç hareketi
      // olmayan (onay bekleyen) üyeler yeni başvuru sayılır, son günlere düşer.
      tarih: ledger.length
        ? gun(Math.round((Date.now() - ledger[ledger.length - 1].ts) / 86400000) + 2 + (i % 5))
        : gun(1 + (i % 9)),
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
    // izinli/izinsiz; Instagram hesabı olan ve olmayan; seviyelerin dördü de dolu.
    // Alanlar: ad, durum, izin, instagram, nokta, ziyaret, fiş adedi, ortalama
    // fiş tutarı (TL), Instagram paylaşımı, elde kalan puan (hedef bakiye).
    var kisiler = [
      ['Ayşe Yıldız',   'active',  true,  'ayseyildiz', 'KASA1', 26,  42, 515, 4, 34],
      ['Mehmet Kaya',   'active',  false, null,         'KASA1', 18,  16, 180, 0, 12],
      ['Elif Demir',    'active',  true,  'elifdemir',  'MASA3',  7,   5, 128, 3,  3],
      ['Burak Şen',     'pending', false, null,         'KASA1',  0,   0,   0, 0,  0],
      ['Zeynep Ak',     'active',  true,  'zeynep.ak',  'KASA1', 21,  24, 385, 5, 21],
      ['Caner Öz',      'active',  false, null,         'MASA3', 12,   9, 155, 0,  8],
      ['Derya Tunç',    'active',  true,  'deryatunc',  'KASA1', 15,  14, 305, 2, 17],
      ['Emre Balcı',    'active',  false, null,         'KASA1',  3,   1, 120, 0,  4],
      ['Fatma Arslan',  'active',  true,  null,         'MASA3', 19,  21, 390, 0, 26],
      ['Gökhan Yurt',   'pending', false, null,         'MASA3',  0,   0,   0, 0,  0],
      ['Hale Kurt',     'active',  true,  'halekurt',   'KASA1',  9,   6, 165, 1,  9],
      ['İlker Doğan',   'active',  false, null,         'KASA1', 14,  11, 240, 0, 11],
      ['Jale Erdem',    'deleted', false, null,         'KASA1',  0,   0,   0, 0,  0],
      ['Kemal Aydın',   'active',  true,  null,         'PAKET',  6,   4, 120, 0,  5],
    ];
    S.ornek = kisiler.map(function (k, i) { return uyeKur(k, i); });

    // Personel kontrolüne düşen fişler: yüksek tutar, düşük okuma güveni ve
    // reddedilmiş bir örnek. Bunlar harcamaya ve puana SAYILMAZ; onaylanınca sayılır.
    function fisEkle(ad, fis) {
      var u = S.ornek.filter(function (x) { return x.ad === ad; })[0];
      if (!u) return;
      fis.id = 'F' + ad.length + '-' + Math.round(fis.tutar * 100);
      fis.uye = u.kod; fis.no = fis.no || String(100000 + Math.round(fis.tutar));
      fis.fisTarih = fis.t;
      // Rozetteki puan elle yazılmaz: üyenin o anki seviyesinden hesaplanır.
      if (fis.durum === 'bekliyor') fis.puan = P.puanFor(fis.tutar, seviyeOf(u).carpan);
      u.fisler.unshift(fis);
    }
    fisEkle('Ayşe Yıldız', { ts: Date.now() - 3600000, t: saat(0, 12, 35), tutar: 1680, isletme: 'PEÇKO FIRIN',
      guven: 0.94, durum: 'bekliyor', sebep: 'Tutar yüksek olduğu için personel kontrolüne alındı.' });
    fisEkle('Caner Öz', { ts: Date.now() - 5 * 3600000, t: saat(0, 10, 5), tutar: 214.5, isletme: 'PEÇKO FIRIN',
      guven: 0.61, durum: 'bekliyor', sebep: 'Okuma netleşmediği için personel kontrolüne alındı.' });
    fisEkle('Derya Tunç', { ts: Date.now() - 26 * 3600000, t: saat(1, 19, 10), tutar: 320, isletme: 'PEÇKO FIRIN',
      guven: 0.58, durum: 'bekliyor', sebep: 'Okuma netleşmediği için personel kontrolüne alındı.' });
    fisEkle('Hale Kurt', { ts: Date.now() - 2 * 86400000, t: saat(2, 15, 40), tutar: 96, isletme: 'SİMİT SARAYI ŞUBE 12',
      guven: 0.93, durum: 'reddedildi', puan: 0,
      sebep: 'Bu fiş bize ait görünmüyor. Yalnızca mağazalarımızdan aldığınız fişler puan kazandırır.' });
    fisEkle('Mehmet Kaya', { ts: Date.now() - 3 * 86400000, t: saat(3, 8, 20), tutar: 0, isletme: '—',
      guven: 0.2, durum: 'reddedildi', puan: 0,
      sebep: 'Fotoğraftan fiş okunamadı. Fişin tamamı görünecek şekilde, düz ve net bir fotoğraf gönderin.' });

    // Rapor ve özet sayaçları bu olay günlüğünden hesaplanır; uydurma satır yok.
    S.hareket = [];
    var turler = [['puan', 1, 62], ['bonus', 1, 11], ['odul', -1, 14]];
    var tohum = 7;
    function rast(n) { tohum = (tohum * 1103515245 + 12345) % 2147483648; return tohum % n; }
    turler.forEach(function (t) {
      for (var i = 0; i < t[2]; i++) {
        var g = rast(30);
        var kisi = S.ornek[rast(S.ornek.length)];
        S.hareket.push({ tur: t[0], gun: g, kod: kisi.kod, nokta: kisi.nokta });
      }
    });

    // Instagram: otomatik eşleşen, personel onaylı, reddedilen ve bekleyenler.
    S.claims = [
      { id: 9001, kullanici: '@deryatunc',   tur: 'hikaye',  durum: 'bekliyor',    puan: 1, tarih: saat(0, 11, 20), kaynak: 'gizli hesap · ekran görüntüsü' },
      { id: 9002, kullanici: '(eşleşmedi)',  tur: 'gönderi', durum: 'bekliyor',    puan: 2, tarih: saat(0, 9, 45),  kaynak: 'ekran görüntüsü' },
      { id: 9003, kullanici: '@ayseyildiz',  tur: 'hikaye',  durum: 'onaylandı',   puan: 1, tarih: saat(1, 16, 5),  kaynak: 'otomatik eşleşme' },
      { id: 9004, kullanici: '@zeynep.ak',   tur: 'gönderi', durum: 'onaylandı',   puan: 2, tarih: saat(2, 13, 30), kaynak: 'otomatik eşleşme' },
      { id: 9005, kullanici: '@halekurt',    tur: 'hikaye',  durum: 'reddedildi',  puan: 0, tarih: saat(4, 18, 12), kaynak: 'etiket görünmüyor' },
      { id: 9006, kullanici: '@elifdemir',   tur: 'hikaye',  durum: 'onaylandı',   puan: 1, tarih: saat(6, 12, 0),  kaynak: 'otomatik eşleşme' },
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
      { t: saat(0, 10, 12), kim: 'Zeynep (personel)', islem: 'puan.eklendi',       detay: '+1 · Kasa 1' },
      { t: saat(0, 9, 48),  kim: 'Mert (personel)',   islem: 'odul.verildi',        detay: '1 adet hediye kahve' },
      { t: saat(0, 12, 36), kim: 'sistem',            islem: 'fis.kontrol',         detay: '1.680,00 TL · tutar yüksek' },
      { t: saat(0, 11, 2),  kim: 'sistem',            islem: 'fis.onay',            detay: '465,00 TL · +9 puan' },
      { t: saat(1, 17, 3),  kim: 'yönetici',          islem: 'instagram.onay',      detay: '@ayseyildiz · +1' },
      { t: saat(2, 15, 41), kim: 'sistem',            islem: 'fis.red',             detay: 'unvan eşleşmedi' },
      { t: saat(1, 14, 22), kim: 'yönetici',          islem: 'customer.phone_revealed', detay: 'gerekçe: ödül doğrulaması' },
      { t: saat(2, 19, 40), kim: 'yönetici',          islem: 'kampanya.gonderildi', detay: 'Ekim kahve kampanyası · 38 mesaj' },
      { t: saat(3, 11, 15), kim: 'Selin (personel)',  islem: 'puan.duzeltme',      detay: '-1 · gerekçe: çift okutma' },
      { t: saat(4, 18, 30), kim: 'yönetici',          islem: 'instagram.red',       detay: '@halekurt' },
      { t: saat(5, 9, 5),   kim: 'yönetici',          islem: 'iys.aktarim',         detay: '12 kayıt' },
      { t: saat(7, 16, 50), kim: 'yönetici',          islem: 'customer.deleted',    detay: 'KVKK silme talebi' },
      { t: saat(9, 12, 0),  kim: 'yönetici',          islem: 'odul.eklendi',        detay: 'Dilim yaş pasta · 16 puan' },
      { t: saat(12, 8, 40), kim: 'yönetici',          islem: 'personel.pasif',      detay: 'Onur' },
      { t: saat(12, 8, 35), kim: 'yönetici',          islem: 'oturum.kapatildi',    detay: '3 oturum' },
    ];

    // Giden mesaj sağlığı: başarısız gönderimlerin görünür olması panelin asıl
    // işlevlerinden biri — erişim anahtarı düşerse ilk uyarı buradan gelir.
    S.giden = {
      gonderildi: 312, basarisiz: 2, saat: 24,
      hatalar: [
        { t: saat(0, 8, 12), tur: 'puan bildirimi',
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
     Her iki taraf da aynı alanlara sahip olsun ki üye kartı tek kodla çizilsin. */
  function uyeler(S) {
    var out = [];
    if (S.code) {
      var led = (S.ledger || []).slice();
      var toplam = led.reduce(function (a, r) { return a + r.puan; }, 0);
      var fark = (S.stamps || 0) - toplam;
      // Defter, bu özellik eklenmeden önceki puanları bilmez; aradaki farkı
      // uydurmak yerine "önceki hareketler" diye ayrı bir satırda gösteririz.
      if (fark) led.push({ ts: 0, t: (S.createdAt || P.today()), tur: 'onceki', puan: fark, not: 'Önceki hareketler' });
      out.push({ kod: S.code, ad: 'Test Müşteri', puan: S.stamps, durum: S.status,
        pazarlama: S.marketing, odul: S.redeemed || 0, ig: S.ig, nokta: S.token,
        tarih: (S.createdAt || '').split(' ')[0] || P.today(), gercek: true,
        fisler: S.receipts || [],
        igler: (S.claims || []).filter(function (c) { return c.gercek; }).map(function (c) {
          return { tur: c.tur, tarih: c.tarih, durum: c.durum, puan: c.puan, kaynak: c.kaynak };
        }),
        kaynak: dokumHesapla(led), ledger: led });
    }
    return out.concat(S.ornek || []);
  }

  var KAYNAK_ADI = { ziyaret: ['🏪', 'Ziyaret'], fis: ['🧾', 'Fiş'], instagram: ['📸', 'Instagram'],
    odul: ['🎁', 'Kullanılan ödül'], onceki: ['•', 'Önceki hareketler'] };

  function dokumHesapla(ledger) {
    var d = {};
    (ledger || []).forEach(function (r) {
      d[r.tur] = d[r.tur] || { adet: 0, puan: 0 };
      d[r.tur].adet++; d[r.tur].puan += r.puan;
    });
    return d;
  }
  // Harcama tek kaynaktan: onaylanmış ve dönem içindeki fişler.
  function harcamaOf(u) {
    var sinir = Date.now() - P.TIER_WINDOW_DAYS * 86400000;
    return (u.fisler || []).reduce(function (a, r) {
      return a + (r.durum === 'onaylandı' && r.ts >= sinir ? r.tutar : 0);
    }, 0);
  }
  function seviyeOf(u) { return P.tierForSpend(harcamaOf(u)); }
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
      var u = uyeler(S), aktifUye = u.filter(function (x) { return x.durum === 'active'; }).length;
      var bekleyen = (S.claims || []).filter(function (c) { return c.durum === 'bekliyor'; }).length;
      var iysBekleyen = (S.iys || []).filter(function (r) { return !r.aktarim; }).length;
      var fisBekleyen = tumFisler(S).filter(function (x) { return x.fis.durum === 'bekliyor'; }).length;
      var ciro = tumFisler(S).reduce(function (a, x) { return a + (x.fis.durum === 'onaylandı' ? x.fis.tutar : 0); }, 0);
      var sonUyeler = u.slice(0, 4).map(uyeSatiri).join('');
      return '<dl class="tiles">' +
          kutu('Aktif üye', aktifUye) + kutu('Bugün puan', bugunPuan(S)) +
          kutu('Bekleyen fiş', fisBekleyen) + kutu('Okunan ciro', P.tlKisa(ciro)) +
          kutu('Bekleyen paylaşım', bekleyen) + kutu('İYS bekleyen', iysBekleyen) +
        '</dl>' +
        (fisBekleyen ? '<div class="uyari"><b>' + fisBekleyen + ' fiş onay bekliyor.</b> ' +
          'Yüksek tutarlı ve okuması netleşmeyen fişler personel kararını bekler — ' +
          '<a href="fisler/">Fişler sekmesi</a>.</div>' : '') +
        sistemDurumu(S) +
        '<h2 style="font-size:1rem;margin:1rem 0 .5rem;color:var(--cocoa)">Son üyeler</h2>' +
        (sonUyeler ? '<div class="list">' + sonUyeler + '</div>' : '<p class="bosluk">Henüz üye yok. QR akışını tamamlayın.</p>') +
        '<a class="btn btn-sec" href="../kasa/">Kasa ekranını aç</a>';
    }
  };
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
  // Sayaçlar mock olay günlüğünden + bu cihazdaki gerçek akıştan gelir.
  function hareketSay(S, tur, gunAraligi) {
    var n = (S.hareket || []).filter(function (h) {
      return h.tur === tur && h.gun < gunAraligi;
    }).length;
    if (tur === 'puan') {
      var b = P.today();
      n += (S.events || []).filter(function (e) { return e.indexOf('• ' + b) === 0 && e.indexOf('Puan') > -1; }).length;
    }
    return n;
  }
  function bugunPuan(S) { return hareketSay(S, 'puan', 1); }

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
    var sv = seviyeOf(x), bek = fisSay(x, 'bekliyor');
    return '<button type="button" class="item" data-is="uyeKart" data-kod="' + x.kod + '">' +
      '<span><span class="mono">' + x.kod + '</span>' +
      '<span class="sub">' + P.esc(x.ad) + (x.gercek ? ' · <b>bu cihazdaki üye</b>' : '') +
      (x.ig ? ' · @' + P.esc(x.ig) : '') + ' · ' + (x.nokta || '—') + ' · ' + x.tarih + '</span>' +
      '<span class="sub">' + sv.ad + ' · ' + P.tl(harcamaOf(x)) + ' harcama' +
      (bek ? ' · <b>' + bek + ' fiş bekliyor</b>' : '') + '</span></span>' +
      '<span class="right">' + x.puan + ' puan<br>' + rozet(x.durum) +
      (x.pazarlama ? ' <span class="tag ok">izinli</span>' : '') + '<span class="ok">›</span></span></button>';
  }
  ISLER.uyeKart = function (S, b) { kartAc(b.dataset.kod); };

  ISLER.uyeCsv = function (S) {
    var satir = [['Üye kodu', 'Durum', 'Ad', 'Instagram', 'Puan', 'Harcama (TL)', 'Seviye', 'Fiş',
      'Kullanılan ödül', 'Kampanya izni', 'Kayıt noktası', 'Kayıt']];
    uyeler(S).forEach(function (x) {
      satir.push([x.kod, { active: 'Aktif', pending: 'Onay bekliyor', deleted: 'Silindi' }[x.durum] || x.durum,
        x.ad, x.ig ? '@' + x.ig : '', x.puan,
        harcamaOf(x).toFixed(2).replace('.', ','), seviyeOf(x).ad, (x.fisler || []).length, x.odul || 0,
        x.pazarlama ? 'Evet' : 'Hayır', x.nokta || '', x.tarih]);
    });
    P.audit(S, 'uye.disa_aktarim', satir.length - 1 + ' kayıt'); P.save(S);
    csvIndir('uyeler-' + P.today().replace(/\./g, '-') + '.csv', satir);
  };

  /* ===================== ÜYE KARTI (modal) =====================
     Panelde bir üyeye dokunulduğunda açılır: puanı, harcaması, seviyesi,
     yüklediği fişler, Instagram paylaşımları ve puanın hangi kaynaktan
     geldiği tek ekranda. Sayılar uydurulmaz, üyenin kendi hareketlerinden
     hesaplanır — döküm toplamı her zaman bakiyeye eşittir. */
  function kartAc(kod) {
    var S = P.load(), u = uyeler(S).filter(function (x) { return x.kod === kod; })[0];
    if (!u) return;
    var eski = document.getElementById('kart');
    if (eski) eski.remove();
    var d = document.createElement('div');
    d.className = 'kart'; d.id = 'kart';
    d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
    d.setAttribute('aria-label', u.ad + ' üye kartı');
    d.innerHTML = '<div class="kart-in">' + kartIcerik(u, S) + '</div>';
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

  function kartIcerik(u, S) {
    var sv = seviyeOf(u), harcama = harcamaOf(u);
    var bekleyen = fisSay(u, 'bekliyor');
    var alt = sv.esik, ust = sv.sonraki ? sv.sonraki.esik : Math.max(harcama, 1);
    var oran = ust > alt ? Math.min(100, Math.round(((harcama - alt) / (ust - alt)) * 100)) : 100;

    // Döküm: kazandıran kaynaklar çubukla, kullanılan ödül ayrı satırda.
    var k = u.kaynak || {};
    var artilar = ['fis', 'ziyaret', 'instagram', 'onceki'].filter(function (t) { return k[t] && k[t].puan > 0; });
    var enBuyuk = artilar.reduce(function (a, t) { return Math.max(a, k[t].puan); }, 1);
    var dokum = artilar.map(function (t) {
      var ad = KAYNAK_ADI[t] || ['•', t];
      return '<div class="dk"><span class="dk-ad">' + ad[0] + ' ' + ad[1] +
        '<small>' + k[t].adet + ' hareket</small></span>' +
        '<span class="dk-cubuk"><i style="width:' + Math.round((k[t].puan / enBuyuk) * 100) + '%"></i></span>' +
        '<b>+' + k[t].puan + '</b></div>';
    }).join('');
    var eksiler = ['odul'].filter(function (t) { return k[t] && k[t].puan; }).map(function (t) {
      return '<div class="dk eksi"><span class="dk-ad">' + KAYNAK_ADI[t][0] + ' ' + KAYNAK_ADI[t][1] +
        '<small>' + k[t].adet + ' kez</small></span><span class="dk-cubuk"></span><b>' + k[t].puan + '</b></div>';
    }).join('');

    var fisler = (u.fisler || []).slice(0, 10).map(function (r) {
      var etiket = { 'onaylandı': 'ok', 'bekliyor': 'bek', 'reddedildi': 'red' }[r.durum] || 'bek';
      return '<div class="item"><span><b>' + P.tl(r.tutar) + '</b>' +
        '<span class="sub">' + r.t + (r.no ? ' · fiş no ' + r.no : '') +
        (r.guven ? ' · güven %' + Math.round(r.guven * 100) : '') +
        (r.sebep ? '<br>' + P.esc(r.sebep) : '') + '</span></span>' +
        '<span class="right"><span class="tag ' + etiket + '">' + r.durum + '</span>' +
        (r.durum === 'onaylandı' ? '<br>+' + r.puan + ' puan' : '') + '</span></div>';
    }).join('');

    var igler = (u.igler || []).slice(0, 8).map(function (c) {
      return '<div class="item"><span><b>' + c.tur + '</b><span class="sub">' + c.tarih + ' · ' + c.kaynak + '</span></span>' +
        '<span class="right"><span class="tag ' + (c.durum === 'onaylandı' ? 'ok' : c.durum === 'reddedildi' ? 'red' : 'bek') + '">' +
        c.durum + '</span>' + (c.durum === 'onaylandı' ? '<br>+' + c.puan + ' puan' : '') + '</span></div>';
    }).join('');

    var hareket = (u.ledger || []).slice(0, 12).map(function (r) {
      return '<tr><td style="white-space:nowrap">' + r.t + '</td><td>' + P.esc(r.not) + '</td>' +
        '<td class="n"><b style="color:' + (r.puan < 0 ? 'var(--marka-kirmizi)' : 'var(--ok)') + '">' +
        (r.puan > 0 ? '+' : '') + r.puan + '</b></td></tr>';
    }).join('');

    return '<header class="kart-bas">' +
        '<div><b>' + P.esc(u.ad) + '</b><span class="mono">' + u.kod + '</span></div>' +
        '<button class="kapat" type="button" data-kapat aria-label="Kapat">✕</button></header>' +
      '<div class="kart-govde">' +
        '<p class="kart-alt">' + rozet(u.durum) + (u.pazarlama ? ' <span class="tag ok">kampanya izinli</span>' : '') +
          (u.ig ? ' <span class="tag sil">@' + P.esc(u.ig) + '</span>' : '') +
          (u.gercek ? ' <span class="tag bek">bu cihazdaki üye</span>' : '') +
          '<br><span class="sub">Kayıt: ' + u.tarih + ' · nokta: ' + (u.nokta || '—') +
          ' · telefon: <b>+90 (5**) *** ** ' + (u.kod.slice(-2)) + '</b></span></p>' +
        '<dl class="tiles">' + kutu('Puan', u.puan) + kutu('Harcama', P.tlKisa(harcama)) +
          kutu('Seviye', sv.ad) + kutu('Fiş', (u.fisler || []).length) + '</dl>' +
        (bekleyen ? '<div class="uyari"><b>' + bekleyen + ' fiş onay bekliyor.</b> ' +
          'Fişler sekmesinden karar verin; onaylanan tutar harcamaya ve puana o anda eklenir.</div>' : '') +
        '<div class="seviye"><div class="sv-ust"><b>' + sv.ad + '</b>' +
          '<span class="cost">' + (sv.carpan > 1 ? 'puan ×' + sv.carpan : 'normal puan') + '</span></div>' +
          '<div class="sv-cubuk"><i style="width:' + oran + '%"></i></div>' +
          '<p class="sub" style="margin:.45rem 0 0">Son 12 ayda ' + P.tl(harcama) +
          (sv.sonraki ? ' · <b>' + sv.sonraki.ad + '</b> seviyesine ' + P.tlKisa(sv.kalanTl) + ' kaldı' : ' · en üst seviye') +
          '</p></div>' +
        '<h3 class="kart-bas3">Puan nereden geldi</h3>' +
        (dokum || eksiler ? '<div class="dokum">' + dokum + eksiler +
          '<div class="dk toplam"><span class="dk-ad">Bakiye</span><span class="dk-cubuk"></span><b>' +
          u.puan + '</b></div></div>'
          : '<p class="bosluk">Henüz puan hareketi yok.</p>') +
        '<h3 class="kart-bas3">Fişler</h3>' +
        (fisler ? '<div class="list">' + fisler + '</div>'
          : '<p class="bosluk">Bu üye henüz fiş yüklemedi.</p>') +
        '<h3 class="kart-bas3">Instagram paylaşımları</h3>' +
        (igler ? '<div class="list">' + igler + '</div>'
          : '<p class="bosluk">Paylaşım kaydı yok' + (u.ig ? '.' : '; Instagram hesabı da kayıtlı değil.') + '</p>') +
        '<h3 class="kart-bas3">Son hareketler</h3>' +
        (hareket ? '<div class="tw"><table class="t"><thead><tr><th>Zaman</th><th>Hareket</th><th class="n">Puan</th></tr></thead><tbody>' +
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
      var puan = onayli.reduce(function (a, x) { return a + x.fis.puan; }, 0);

      return '<div class="uyari">Müşteri <b>FIS</b> yazıp fişin fotoğrafını gönderir; tutar okunur ve ' +
          'her ' + P.RECEIPT.tlBasina + ' TL için 1 puan eklenir. Otomatik sonuçlanmayanlar — ' +
          P.tlKisa(P.RECEIPT.kontrolUstu) + ' üstü ve okuması netleşmeyen fişler — buraya düşer.</div>' +
        '<dl class="tiles">' + kutu('Bekleyen', bekleyen.length) + kutu('Bugün gelen', bugunku) +
          kutu('Fişten puan', puan) + kutu('Okunan ciro', P.tlKisa(ciro)) + '</dl>' +
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
                (x.fis.durum === 'onaylandı' ? '<br><span style="color:var(--ok);font-size:.74rem">+' + x.fis.puan + ' puan</span>' : '') +
                '</td><td><span class="tag ' + (x.fis.durum === 'onaylandı' ? 'ok' : 'red') + '">' + x.fis.durum + '</span>' +
                (x.fis.sebep ? '<br><span style="color:var(--muted);font-size:.72rem">' + P.esc(x.fis.sebep) + '</span>' : '') +
                '</td></tr>';
            }).join('') + '</tbody></table></div>'
          : '') +
        '<button class="btn btn-sec" data-is="fisCsv">Fiş listesini CSV indir</button>';
    }
  };

  function fisSatiri(x, karar) {
    var f = x.fis, u = x.uye;
    var sv = seviyeOf(u);
    return '<div class="item" style="align-items:flex-start">' +
      (f.gorsel ? '<img class="fis-onizleme" src="' + f.gorsel + '" alt="Fiş fotoğrafı">' : '') +
      '<span><b>' + P.tl(f.tutar) + '</b> <span class="tag bek">+' + (f.puan || 0) + ' puan</span>' +
      '<span class="sub">' + P.esc(u.ad) + ' · <span class="mono">' + u.kod + '</span> · ' + sv.ad +
      (sv.carpan > 1 ? ' (×' + sv.carpan + ')' : '') + '</span>' +
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
      f.durum = 'reddedildi'; f.puan = 0;
      f.sebep = sebep.trim() || 'Personel reddetti.';
      if (gercek) mesaj(S, P.MSG.receiptRejected(f.sebep), 'Fiş: personel reddetti');
      P.audit(S, 'fis.red', P.tl(f.tutar) + ' · ' + kod);
      P.save(S); yenile();
      return;
    }

    // Puan, onay anındaki seviyeye göre hesaplanır; fişin kendisi harcamaya
    // ancak onaylandıktan sonra girer, bu yüzden önce çarpan alınır.
    var sv = seviyeOf(u);
    var puan = P.puanFor(f.tutar, sv.carpan);
    if (!puan) { alert('Bu fişten puan çıkmıyor; tutarı kontrol edin.'); return; }
    if (!confirm(P.tl(f.tutar) + ' onaylanacak ve ' + u.ad + ' üyesine +' + puan + ' puan eklenecek. Onaylıyor musunuz?')) return;
    f.durum = 'onaylandı'; f.puan = puan; f.sebep = null;

    if (gercek) {
      S.stamps += puan;
      P.event(S, 'Fiş +' + puan + ' (' + P.tl(f.tutar) + ')', 'fis', puan);
      mesaj(S, P.MSG.receiptApproved({ tutar: f.tutar, puan: puan, toplam: S.stamps, seviye: P.tierForSpend(harcamaOf(u)) }),
        'Fiş: personel onayladı', 'puan');
    } else {
      u.puan += puan;
      u.kaynak = u.kaynak || {};
      u.kaynak.fis = u.kaynak.fis || { adet: 0, puan: 0 };
      u.kaynak.fis.adet++; u.kaynak.fis.puan += puan;
      u.ledger.unshift({ ts: Date.now(), t: P.today() + ' ' + P.now(), tur: 'fis', puan: puan,
        not: 'Fiş +' + puan + ' (' + P.tl(f.tutar) + ')' });
    }
    P.audit(S, 'fis.onay', P.tl(f.tutar) + ' · +' + puan + ' puan · ' + kod);
    P.save(S); yenile();
  }

  ISLER.fisCsv = function (S) {
    var satir = [['Tarih', 'Üye kodu', 'Ad', 'İşletme', 'Fiş no', 'Tutar (TL)', 'Okuma güveni', 'Durum', 'Puan', 'Not']];
    tumFisler(S).forEach(function (x) {
      satir.push([x.fis.t, x.uye.kod, x.uye.ad, x.fis.isletme || '', x.fis.no || '',
        Number(x.fis.tutar || 0).toFixed(2).replace('.', ','),
        Math.round((x.fis.guven || 0) * 100) + '%', x.fis.durum, x.fis.puan || 0, x.fis.sebep || '']);
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
      return '<div class="uyari">Buradaki değişiklik müşteriye giden mesajlara ve puan sayfasına ' +
          'anında yansır — <b>PUANIM</b> yazdığında yeni katalogla yanıt alır.</div>' +
        grup('urun', 'Ürün ödülleri', 'Puan karşılığı verilen ürün.') +
        grup('yuzde', 'Yüzde indirimi', 'Kademeli indirim: puan arttıkça oran yükselir. ' +
          'İndirimin tek kaynağı budur — seviye indirim vermez, yalnızca puanı hızlandırır.') +
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
      S.stamps += c.puan;
      P.event(S, 'Bonus +' + c.puan + ' (Instagram ' + c.tur + ')', 'instagram', c.puan);
      mesaj(S, 'Instagram ' + (c.tur === 'gönderi' ? 'gönderiniz' : 'hikayeniz') + ' onaylandı, +' + c.puan +
        ' puan kazandınız! 🎉 Toplam puan: ' + S.stamps + '.', 'Instagram: personel onayladı');
    }
    P.audit(S, 'instagram.onay', c.kullanici + ' · +' + c.puan); P.save(S); yenile();
  };
  ISLER.igRed = function (S, b) {
    var c = S.claims.filter(function (x) { return String(x.id) === b.dataset.id; })[0];
    if (!c || c.durum !== 'bekliyor') return;
    c.durum = 'reddedildi';
    mesaj(S, 'Instagram paylaşımınızı maalesef onaylayamadık: hesabımızın etiketi görünmüyor. ' +
      'Etiketin göründüğü bir ekran görüntüsüyle tekrar deneyebilirsiniz.', 'Instagram: personel reddetti');
    P.audit(S, 'instagram.red', c.kullanici); P.save(S); yenile();
  };

  /* ===================== RAPOR ===================== */
  // Rapor satırları olay günlüğünden hesaplanır: tablo ile sayaçlar tutarlı kalsın.
  function donemler(S) {
    var ad = ['Bu hafta', 'Geçen hafta', 'İki hafta önce', 'Üç hafta önce'];
    var uyeListe = uyeler(S);
    return ad.map(function (etiket, i) {
      var bas = i * 7, son = bas + 7;
      var icinde = function (h) { return h.gun >= bas && h.gun < son; };
      var hareket = (S.hareket || []).filter(icinde);
      var yeniUye = uyeListe.filter(function (x) {
        var g = gunFarki(x.tarih);
        return g !== null && g >= bas && g < son;
      }).length;
      // Fiş sayıları uydurulmaz: üyelerin gerçek fiş kayıtlarından okunur.
      var fisler = tumFisler(S).filter(function (x) {
        var g = Math.floor((Date.now() - x.fis.ts) / 86400000);
        return g >= bas && g < son && x.fis.durum === 'onaylandı';
      });
      return {
        etiket: etiket,
        uye: yeniUye,
        puan: hareket.filter(function (h) { return h.tur === 'puan'; }).length + (i === 0 ? bugunPuan(S) : 0),
        bonus: hareket.filter(function (h) { return h.tur === 'bonus'; }).length,
        odul: hareket.filter(function (h) { return h.tur === 'odul'; }).length + (i === 0 ? (S.redeemed || 0) : 0),
        fis: fisler.length,
        ciro: fisler.reduce(function (a, x) { return a + x.fis.tutar; }, 0),
      };
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
      var toplam = d.reduce(function (a, r) { return a + r.puan; }, 0);
      return '<div class="uyari">Örnek veriyle doldurulmuştur; <b>bu cihazdaki gerçek akış</b> ' +
          'sayılara dahildir. Gerçek panelde dönem gün/hafta/ay olarak seçilir.</div>' +
        '<dl class="tiles">' + kutu('30 günde puan', toplam) +
          kutu('Verilen ödül', d.reduce(function (a, r) { return a + r.odul; }, 0)) +
          kutu('Okunan fiş', d.reduce(function (a, r) { return a + r.fis; }, 0)) +
          kutu('Fiş cirosu', P.tlKisa(d.reduce(function (a, r) { return a + r.ciro; }, 0))) + '</dl>' +
        '<div class="tw"><table class="t"><thead><tr><th>Dönem</th><th class="n">Yeni üye</th>' +
        '<th class="n">Puan</th><th class="n">Bonus</th><th class="n">Ödül</th>' +
        '<th class="n">Fiş</th><th class="n">Ciro</th></tr></thead><tbody>' +
        d.map(function (r) {
          return '<tr><td>' + r.etiket + '</td><td class="n">' + r.uye + '</td><td class="n">' + r.puan +
            '</td><td class="n">' + r.bonus + '</td><td class="n">' + r.odul +
            '</td><td class="n">' + r.fis + '</td><td class="n">' + P.tlKisa(r.ciro) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        seviyeDagilimi(S) +
        '<h2 style="font-size:1rem;margin:0 0 .5rem;color:var(--cocoa)">Nokta bazlı okutma</h2>' +
        '<div class="tw"><table class="t"><thead><tr><th>Nokta</th><th class="n">QR</th><th class="n">NFC</th><th class="n">Toplam</th></tr></thead><tbody>' +
        (S.cards || []).map(function (c) {
          return '<tr><td>' + c.etiket + ' <code>' + c.token + '</code>' +
            (c.aktif ? '' : ' <span class="tag sil">pasif</span>') + '</td><td class="n">' + c.qr +
            '</td><td class="n">' + c.nfc + '</td><td class="n">' + (c.qr + c.nfc) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<button class="btn btn-sec" data-is="raporCsv">Raporu CSV indir</button>';
    }
  };
  // Seviyelerin dolulukları: kademelerin işe yarayıp yaramadığı buradan görünür.
  function seviyeDagilimi(S) {
    var aktif = uyeler(S).filter(function (x) { return x.durum === 'active'; });
    var sayim = P.TIERS.map(function (t) { return { ad: t.ad, carpan: t.carpan, adet: 0, ciro: 0 }; });
    aktif.forEach(function (u) {
      var h = harcamaOf(u), i = 0;
      P.TIERS.forEach(function (t, n) { if (h >= t.esik) i = n; });
      sayim[i].adet++; sayim[i].ciro += h;
    });
    return '<h2 style="font-size:1rem;margin:1.2rem 0 .5rem;color:var(--cocoa)">Seviye dağılımı</h2>' +
      '<div class="tw"><table class="t"><thead><tr><th>Seviye</th><th class="n">Üye</th>' +
      '<th class="n">Puan çarpanı</th><th class="n">Toplam harcama</th></tr></thead><tbody>' +
      sayim.map(function (r) {
        return '<tr><td>' + r.ad + '</td><td class="n">' + r.adet + '</td><td class="n">×' + r.carpan +
          '</td><td class="n">' + P.tlKisa(r.ciro) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  ISLER.raporCsv = function (S) {
    var satir = [['Dönem', 'Yeni üye', 'Puan', 'Instagram bonusu', 'Verilen ödül', 'Okunan fiş', 'Fiş cirosu (TL)']];
    donemler(S).forEach(function (r) {
      satir.push([r.etiket, r.uye, r.puan, r.bonus, r.odul, r.fis, r.ciro.toFixed(2).replace('.', ',')]);
    });
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
