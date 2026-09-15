/* Yönetim paneli provası. Müşteri akışıyla aynı durumu paylaşır: panelden yapılan
   işlem müşterinin sohbetine düşer, müşterinin yaptığı panelde görünür. */
(function (w) {
  'use strict';
  var P = w.PECKO, PANEL = {};

  var NAV = [
    ['', 'Özet'], ['uyeler', 'Üyeler'], ['oduller', 'Ödüller'], ['kampanyalar', 'Kampanyalar'],
    ['instagram', 'Instagram'], ['rapor', 'Rapor'], ['qr', 'QR / NFC'], ['iys', 'İYS'],
    ['personel', 'Personel'], ['denetim', 'Denetim'],
  ];

  /* --- örnek veri ------------------------------------------------------
     Panelin her bölümü gerçekte karşılaşacağı durumlarla dolu görünsün diye
     tohumlanır: farklı üyelik durumları, onaylanmış/reddedilmiş/bekleyen
     paylaşımlar, tamamlanmış ve yarım kalmış kampanyalar, gecikmiş İYS
     kaydı. Akıştaki gerçek üye bunlara karışmaz, listede üstte ve etiketli
     durur. MOCK sürümü artınca veri bir kez yenilenir. */
  var MOCK = 3;

  function gun(n) {   // n gün önce, gg.aa.yyyy
    return new Date(Date.now() - n * 86400000).toLocaleDateString('tr-TR');
  }
  function saat(n, s, d) { return gun(n) + ' ' + ('0' + s).slice(-2) + ':' + ('0' + (d || 0)).slice(-2); }

  function seed(S) {
    if (S.mockSurum === MOCK) return S;

    S.rewards = [
      { id: 1, ad: 'Kurabiye (100 gr)', bedel: 5, aktif: true },
      { id: 2, ad: '1 adet hediye kahve', bedel: 10, aktif: true },
      { id: 3, ad: 'Dilim yaş pasta', bedel: 16, aktif: true },
      { id: 4, ad: 'Yaz limonatası', bedel: 8, aktif: false },
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
    // izinli/izinsiz; Instagram hesabı olan ve olmayan.
    var kisiler = [
      ['Ayşe Yıldız',   34, 'active',  true,  2,  'ayseyildiz',  'KASA1'],
      ['Mehmet Kaya',   12, 'active',  false, 5,  null,          'KASA1'],
      ['Elif Demir',     3, 'active',  true,  1,  'elifdemir',   'MASA3'],
      ['Burak Şen',      0, 'pending', false, 0,  null,          'KASA1'],
      ['Zeynep Ak',     21, 'active',  true,  3,  'zeynep.ak',   'KASA1'],
      ['Caner Öz',       8, 'active',  false, 0,  null,          'MASA3'],
      ['Derya Tunç',    17, 'active',  true,  1,  'deryatunc',   'KASA1'],
      ['Emre Balcı',     1, 'active',  false, 0,  null,          'KASA1'],
      ['Fatma Arslan',  26, 'active',  true,  4,  null,          'MASA3'],
      ['Gökhan Yurt',    0, 'pending', false, 0,  null,          'MASA3'],
      ['Hale Kurt',      6, 'active',  true,  0,  'halekurt',    'KASA1'],
      ['İlker Doğan',   11, 'active',  false, 1,  null,          'KASA1'],
      ['Jale Erdem',     0, 'deleted', false, 2,  null,          'KASA1'],
      ['Kemal Aydın',    4, 'active',  true,  0,  null,          'PAKET'],
    ];
    S.ornek = kisiler.map(function (k, i) {
      return { kod: P.newCode(), ad: k[0], damga: k[1], durum: k[2], pazarlama: k[3],
        odul: k[4], ig: k[5], nokta: k[6], tarih: gun(3 + i * 2 + (i % 3)), ornek: true };
    });

    // Rapor ve özet sayaçları bu olay günlüğünden hesaplanır; uydurma satır yok.
    S.hareket = [];
    var turler = [['damga', 1, 62], ['bonus', 1, 11], ['odul', -1, 14]];
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
      { id: 9001, kullanici: '@deryatunc',   tur: 'hikaye',  durum: 'bekliyor',    damga: 1, tarih: saat(0, 11, 20), kaynak: 'gizli hesap · ekran görüntüsü' },
      { id: 9002, kullanici: '(eşleşmedi)',  tur: 'gönderi', durum: 'bekliyor',    damga: 2, tarih: saat(0, 9, 45),  kaynak: 'ekran görüntüsü' },
      { id: 9003, kullanici: '@ayseyildiz',  tur: 'hikaye',  durum: 'onaylandı',   damga: 1, tarih: saat(1, 16, 5),  kaynak: 'otomatik eşleşme' },
      { id: 9004, kullanici: '@zeynep.ak',   tur: 'gönderi', durum: 'onaylandı',   damga: 2, tarih: saat(2, 13, 30), kaynak: 'otomatik eşleşme' },
      { id: 9005, kullanici: '@halekurt',    tur: 'hikaye',  durum: 'reddedildi',  damga: 0, tarih: saat(4, 18, 12), kaynak: 'etiket görünmüyor' },
      { id: 9006, kullanici: '@elifdemir',   tur: 'hikaye',  durum: 'onaylandı',   damga: 1, tarih: saat(6, 12, 0),  kaynak: 'otomatik eşleşme' },
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
      { t: saat(0, 10, 12), kim: 'Zeynep (personel)', islem: 'damga.eklendi',       detay: '+1 · Kasa 1' },
      { t: saat(0, 9, 48),  kim: 'Mert (personel)',   islem: 'odul.verildi',        detay: '1 adet hediye kahve' },
      { t: saat(1, 17, 3),  kim: 'yönetici',          islem: 'instagram.onay',      detay: '@ayseyildiz · +1' },
      { t: saat(1, 14, 22), kim: 'yönetici',          islem: 'customer.phone_revealed', detay: 'gerekçe: ödül doğrulaması' },
      { t: saat(2, 19, 40), kim: 'yönetici',          islem: 'kampanya.gonderildi', detay: 'Ekim kahve kampanyası · 38 mesaj' },
      { t: saat(3, 11, 15), kim: 'Selin (personel)',  islem: 'damga.duzeltme',      detay: '-1 · gerekçe: çift okutma' },
      { t: saat(4, 18, 30), kim: 'yönetici',          islem: 'instagram.red',       detay: '@halekurt' },
      { t: saat(5, 9, 5),   kim: 'yönetici',          islem: 'iys.aktarim',         detay: '12 kayıt' },
      { t: saat(7, 16, 50), kim: 'yönetici',          islem: 'customer.deleted',    detay: 'KVKK silme talebi' },
      { t: saat(9, 12, 0),  kim: 'yönetici',          islem: 'odul.eklendi',        detay: 'Dilim yaş pasta · 16 damga' },
      { t: saat(12, 8, 40), kim: 'yönetici',          islem: 'personel.pasif',      detay: 'Onur' },
      { t: saat(12, 8, 35), kim: 'yönetici',          islem: 'oturum.kapatildi',    detay: '3 oturum' },
    ];

    // Giden mesaj sağlığı: başarısız gönderimlerin görünür olması panelin asıl
    // işlevlerinden biri — erişim anahtarı düşerse ilk uyarı buradan gelir.
    S.giden = {
      gonderildi: 312, basarisiz: 2, saat: 24,
      hatalar: [
        { t: saat(0, 8, 12), tur: 'damga bildirimi',
          hata: '(#131047) 24 saatlik pencere kapalı; şablon tanımlı değil' },
        { t: saat(0, 7, 40), tur: 'kampanya',
          hata: '(#130429) Dakikalık gönderim sınırı aşıldı, alıcı kuyrukta kaldı' },
      ],
    };
    S.isler = [
      { ad: 'Saklama süresi temizliği', son: saat(0, 4, 0), hata: null },
      { ad: 'Instagram etiket sorgusu', son: saat(0, 9, 55), hata: null },
      { ad: 'Kampanya gönderimi', son: saat(0, 9, 40), hata: null },
    ];

    S.mockSurum = MOCK;
    P.save(S);
    return S;
  }
  function yeniTarih(n) { return gun(-n); }

  /* --- üyeler: akıştaki gerçek üye + örnekler --- */
  function uyeler(S) {
    var out = [];
    if (S.code) {
      out.push({ kod: S.code, ad: 'Test Müşteri', damga: S.stamps, durum: S.status,
        pazarlama: S.marketing, odul: S.redeemed || 0, ig: S.ig, nokta: S.token,
        tarih: (S.createdAt || '').split(' ')[0] || P.today(), gercek: true });
    }
    return out.concat(S.ornek || []);
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
      var sonUyeler = u.slice(0, 4).map(function (x) {
        return '<div class="item"><span><span class="mono">' + x.kod + '</span>' +
          '<span class="sub">' + P.esc(x.ad) + ' · ' + x.tarih + '</span></span>' +
          '<span class="right">' + x.damga + ' damga<br>' + rozet(x.durum) + '</span></div>';
      }).join('');
      return '<dl class="tiles">' +
          kutu('Aktif üye', aktifUye) + kutu('Bugün damga', bugunDamga(S)) +
          kutu('Bekleyen paylaşım', bekleyen) + kutu('İYS bekleyen', iysBekleyen) +
        '</dl>' +
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
    if (tur === 'damga') {
      var b = P.today();
      n += (S.events || []).filter(function (e) { return e.indexOf('• ' + b) === 0 && e.indexOf('Damga') > -1; }).length;
    }
    return n;
  }
  function bugunDamga(S) { return hareketSay(S, 'damga', 1); }

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
          ? '<div class="list">' + liste.map(function (x) {
              return '<div class="item"><span><span class="mono">' + x.kod + '</span>' +
                '<span class="sub">' + P.esc(x.ad) + (x.gercek ? ' · <b>bu cihazdaki üye</b>' : '') +
                (x.ig ? ' · @' + P.esc(x.ig) : '') + ' · ' + (x.nokta || '—') + ' · ' + x.tarih + '</span></span>' +
                '<span class="right">' + x.damga + ' damga<br>' + rozet(x.durum) +
                (x.pazarlama ? ' <span class="tag ok">izinli</span>' : '') + '</span></div>';
            }).join('') + '</div>'
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
  ISLER.uyeCsv = function (S) {
    var satir = [['Üye kodu', 'Durum', 'Ad', 'Instagram', 'Damga', 'Kullanılan ödül', 'Kampanya izni', 'Kayıt noktası', 'Kayıt']];
    uyeler(S).forEach(function (x) {
      satir.push([x.kod, { active: 'Aktif', pending: 'Onay bekliyor', deleted: 'Silindi' }[x.durum] || x.durum,
        x.ad, x.ig ? '@' + x.ig : '', x.damga, x.odul || 0,
        x.pazarlama ? 'Evet' : 'Hayır', x.nokta || '', x.tarih]);
    });
    P.audit(S, 'uye.disa_aktarim', satir.length - 1 + ' kayıt'); P.save(S);
    csvIndir('uyeler-' + P.today().replace(/\./g, '-') + '.csv', satir);
  };

  /* ===================== ÖDÜLLER ===================== */
  SAYFA.oduller = {
    baslik: 'Ödüller',
    ciz: function (S) {
      return '<div class="uyari">Buradaki değişiklik müşteriye giden mesajlara ve puan sayfasına ' +
          'anında yansır — <b>PUANIM</b> yazdığında yeni katalogla yanıt alır.</div>' +
        '<div class="list">' + (S.rewards || []).map(function (r) {
          return '<div class="item"><span><b>' + P.esc(r.ad) + '</b>' +
            '<span class="sub">' + r.bedel + ' damga</span></span>' +
            '<span class="right"><button class="btn btn-sec" style="width:auto;min-height:38px;padding:0 .7rem" ' +
            'data-is="odulDurum" data-id="' + r.id + '">' + (r.aktif ? 'Pasife al' : 'Aktif et') + '</button></span></div>';
        }).join('') + '</div>' +
        '<form class="form" id="yeni"><h3>Yeni ödül</h3>' +
          '<label>Ödül adı<input id="ad" required maxlength="60" placeholder="Limonata"></label>' +
          '<label>Damga bedeli<input id="bedel" type="number" min="1" max="1000" required value="8"></label>' +
          '<button class="btn btn-primary">Ödülü ekle</button></form>';
    },
    bagla: function () {
      document.getElementById('yeni').addEventListener('submit', function (e) {
        e.preventDefault();
        var S = P.load(), ad = document.getElementById('ad').value.trim();
        var bedel = parseInt(document.getElementById('bedel').value, 10);
        if (!ad || !(bedel >= 1 && bedel <= 1000)) return;
        S.rewards.push({ id: Date.now(), ad: ad, bedel: bedel, aktif: true });
        P.audit(S, 'odul.eklendi', ad + ' · ' + bedel + ' damga'); P.save(S); yenile();
      });
    }
  };
  ISLER.odulDurum = function (S, b) {
    var r = S.rewards.filter(function (x) { return String(x.id) === b.dataset.id; })[0];
    if (!r) return;
    r.aktif = !r.aktif;
    P.audit(S, 'odul.' + (r.aktif ? 'aktif' : 'pasif'), r.ad); P.save(S); yenile();
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
          'damga eklenir. Buraya yalnızca eşleşmeyenler ve gizli hesaplar düşer.</div>' +
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
      S.stamps += c.damga;
      P.event(S, 'Bonus +' + c.damga + ' (Instagram ' + c.tur + ')');
      mesaj(S, 'Instagram ' + (c.tur === 'gönderi' ? 'gönderiniz' : 'hikayeniz') + ' onaylandı, +' + c.damga +
        ' damga kazandınız! 🎉 Toplam damga: ' + S.stamps + '.', 'Instagram: personel onayladı');
    }
    P.audit(S, 'instagram.onay', c.kullanici + ' · +' + c.damga); P.save(S); yenile();
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
      return {
        etiket: etiket,
        uye: yeniUye,
        damga: hareket.filter(function (h) { return h.tur === 'damga'; }).length + (i === 0 ? bugunDamga(S) : 0),
        bonus: hareket.filter(function (h) { return h.tur === 'bonus'; }).length,
        odul: hareket.filter(function (h) { return h.tur === 'odul'; }).length + (i === 0 ? (S.redeemed || 0) : 0),
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
      var toplam = d.reduce(function (a, r) { return a + r.damga; }, 0);
      return '<div class="uyari">Örnek veriyle doldurulmuştur; <b>bu cihazdaki gerçek akış</b> ' +
          'sayılara dahildir. Gerçek panelde dönem gün/hafta/ay olarak seçilir.</div>' +
        '<dl class="tiles">' + kutu('30 günde damga', toplam) +
          kutu('Verilen ödül', d.reduce(function (a, r) { return a + r.odul; }, 0)) + '</dl>' +
        '<div class="tw"><table class="t"><thead><tr><th>Dönem</th><th class="n">Yeni üye</th>' +
        '<th class="n">Damga</th><th class="n">Bonus</th><th class="n">Ödül</th></tr></thead><tbody>' +
        d.map(function (r) {
          return '<tr><td>' + r.etiket + '</td><td class="n">' + r.uye + '</td><td class="n">' + r.damga +
            '</td><td class="n">' + r.bonus + '</td><td class="n">' + r.odul + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
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
  ISLER.raporCsv = function (S) {
    var satir = [['Dönem', 'Yeni üye', 'Damga', 'Instagram bonusu', 'Verilen ödül']];
    donemler(S).forEach(function (r) { satir.push([r.etiket, r.uye, r.damga, r.bonus, r.odul]); });
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
