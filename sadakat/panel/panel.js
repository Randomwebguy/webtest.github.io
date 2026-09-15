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

  /* --- örnek veri: liste ve raporlar boş görünmesin, gerçek üye üstte kalsın --- */
  function seed(S) {
    var d = false;
    if (!S.rewards) {
      S.rewards = [
        { id: 1, ad: '1 adet hediye kahve', bedel: 10, aktif: true },
        { id: 2, ad: 'Kurabiye (100 gr)', bedel: 5, aktif: true },
      ];
      d = true;
    }
    if (!S.staff) { S.staff = [{ id: 1, ad: 'Zeynep', aktif: true }, { id: 2, ad: 'Mert', aktif: true }]; d = true; }
    if (!S.cards) {
      S.cards = [
        { token: 'KASA1', etiket: 'Kasa 1', tur: 'kasa', aktif: true, qr: 0, nfc: 0, nfcDurum: 'kilitli' },
        { token: 'MASA3', etiket: 'Masa 3', tur: 'masa', aktif: true, qr: 0, nfc: 0, nfcDurum: 'yazılmadı' },
      ];
      d = true;
    }
    if (!S.claims) S.claims = [];
    if (!S.campaigns) S.campaigns = [];
    if (!S.audit) S.audit = [];
    if (!S.iys) S.iys = [];
    if (!S.ornek) {
      // Kontrol karakteri gerçek algoritmayla üretilir; kasada aranabilir olsunlar.
      var adlar = [['Ayşe Yıldız', 7, 'active', true], ['Mehmet Kaya', 12, 'active', false],
        ['Elif Demir', 3, 'active', true], ['Burak Şen', 0, 'pending', false], ['Zeynep Ak', 21, 'active', true]];
      S.ornek = adlar.map(function (a, i) {
        return { kod: P.newCode(), ad: a[0], damga: a[1], durum: a[2], pazarlama: a[3],
          tarih: yeniTarih(-(i * 9 + 3)), ornek: true };
      });
      d = true;
    }
    if (d) P.save(S);
    return S;
  }
  function yeniTarih(gunFarki) {
    var t = new Date(Date.now() + gunFarki * 86400000);
    return t.toLocaleDateString('tr-TR');
  }

  /* --- üyeler: akıştaki gerçek üye + örnekler --- */
  function uyeler(S) {
    var out = [];
    if (S.code) {
      out.push({ kod: S.code, ad: 'Test Müşteri', damga: S.stamps, durum: S.status,
        pazarlama: S.marketing, tarih: (S.createdAt || '').split(' ')[0] || P.today(), gercek: true });
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
      '<header class="pbar"><b>' + P.esc(baslik) + '</b>' +
        '<span class="rol">' + (S.shift ? P.esc(S.shift) : 'yönetici') + '</span>' +
        '<a href="' + (aktif ? '../../' : '../') + 'sohbet/">Müşteri</a></header>' +
      '<nav class="pnav">' + nav + '</nav>' +
      '<div class="body"><div class="pad">' + govde + '</div></div></div>';
  }

  PANEL.init = function (sayfa) {
    var S = seed(P.load());
    var c = SAYFA[sayfa || ''];
    document.body.innerHTML = kabuk(S, sayfa || '', c.baslik, c.ciz(S));
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
        '<div class="form"><h3>Sistem durumu</h3>' +
          '<p style="font-size:.84rem;margin:0 0 .5rem">Son 24 saatte <b>' + (S.log || []).filter(function (l) { return l.d === 'in'; }).length +
          '</b> mesaj gönderildi, <b>0</b> tanesi başarısız.</p>' +
          '<p style="font-size:.8rem;color:var(--muted);margin:0">Saklama temizliği · Instagram sorgusu · Kampanya gönderimi: hepsi çalışıyor.</p>' +
        '</div>' +
        '<h2 style="font-size:1rem;margin:1rem 0 .5rem;color:var(--cocoa)">Son üyeler</h2>' +
        (sonUyeler ? '<div class="list">' + sonUyeler + '</div>' : '<p class="bosluk">Henüz üye yok. QR akışını tamamlayın.</p>') +
        '<a class="btn btn-sec" href="../kasa/">Kasa ekranını aç</a>';
    }
  };
  function kutu(ad, deger) { return '<div class="tile"><dt>' + ad + '</dt><dd>' + deger + '</dd></div>'; }
  function rozet(d) {
    return '<span class="tag ' + ({ active: 'ok', pending: 'bek', deleted: 'sil' }[d] || 'sil') + '">' +
      ({ active: 'aktif', pending: 'onay bekliyor', deleted: 'silindi' }[d] || d) + '</span>';
  }
  function bugunDamga(S) {
    var b = P.today();
    return (S.events || []).filter(function (e) { return e.indexOf('• ' + b) === 0 && e.indexOf('Damga') > -1; }).length;
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
          var t = (x.kod + ' ' + x.ad).toLocaleLowerCase('tr-TR');
          return t.indexOf(q.toLocaleLowerCase('tr-TR')) > -1;
        });
        document.getElementById('liste').innerHTML = liste.length
          ? '<div class="list">' + liste.map(function (x) {
              return '<div class="item"><span><span class="mono">' + x.kod + '</span>' +
                '<span class="sub">' + P.esc(x.ad) + (x.gercek ? ' · <b>bu cihazdaki üye</b>' : '') +
                ' · kayıt ' + x.tarih + '</span></span>' +
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
    var satir = [['Üye kodu', 'Durum', 'Ad', 'Damga', 'Kampanya izni', 'Kayıt']];
    uyeler(S).forEach(function (x) {
      satir.push([x.kod, { active: 'Aktif', pending: 'Onay bekliyor', deleted: 'Silindi' }[x.durum] || x.durum,
        x.ad, x.damga, x.pazarlama ? 'Evet' : 'Hayır', x.tarih]);
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
  SAYFA.kampanyalar = {
    baslik: 'Kampanyalar',
    ciz: function (S) {
      var izinli = uyeler(S).filter(function (x) { return x.durum === 'active' && x.pazarlama; });
      var birim = 0.45;
      return '<div class="uyari">WhatsApp, işletmenin başlattığı pazarlama mesajına yalnızca ' +
          '<b>Meta onaylı MARKETING şablonuyla</b> izin verir; serbest metin reddedilir.</div>' +
        '<dl class="tiles">' + kutu('İzinli üye', izinli.length) +
          kutu('Tahmini tutar', (izinli.length * birim).toFixed(2).replace('.', ',') + ' TL') + '</dl>' +
        (S.campaigns.length ? '<div class="list">' + S.campaigns.map(function (k) {
          return '<div class="item"><span><b>' + P.esc(k.ad) + '</b>' +
            '<span class="sub">' + k.sablon + ' · ' + k.olusturma + '</span></span>' +
            '<span class="right">' + (k.durum === 'taslak'
              ? '<button class="btn btn-primary" style="width:auto;min-height:38px;padding:0 .7rem" data-is="kampanyaBaslat" data-id="' + k.id + '">Gönder</button>'
              : '<span class="tag ok">gönderildi</span><br>' + k.gonderildi + ' gitti · ' + k.atlandi + ' atlandı') +
            '</span></div>';
        }).join('') + '</div>' : '') +
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
          alici: izinli, gonderildi: 0, atlandi: 0, olusturma: P.today() });
        P.audit(S, 'kampanya.taslak', ad + ' · ' + izinli + ' alıcı'); P.save(S); yenile();
      });
    }
  };
  ISLER.kampanyaBaslat = function (S, b) {
    var k = S.campaigns.filter(function (x) { return String(x.id) === b.dataset.id; })[0];
    if (!k || k.durum !== 'taslak') return;
    if (!confirm(k.alici + ' üyeye kampanya mesajı gidecek. Onaylıyor musunuz?')) return;
    // Gönderim anında izin yeniden kontrol edilir: DUR yazan atlanır.
    var gercekIzinli = S.status === 'active' && S.marketing;
    k.gonderildi = k.alici; k.atlandi = 0; k.durum = 'tamam';
    if (gercekIzinli) {
      mesaj(S, 'Peçko Pastanesi’nden haber var! 🎂 Bu hafta tüm kahvelerde ikinci fincan bizden. ' +
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
  SAYFA.rapor = {
    baslik: 'Rapor',
    ciz: function (S) {
      var u = uyeler(S);
      var satir = [
        ['Bu hafta', u.filter(function (x) { return x.gercek; }).length, bugunDamga(S), S.redeemed || 0],
        ['Geçen hafta', 2, 14, 1], ['İki hafta önce', 1, 9, 0], ['Üç hafta önce', 2, 11, 1],
      ];
      return '<div class="uyari">Örnek dönemler geçmiş veriyi temsil eder; <b>Bu hafta</b> satırı ' +
          'bu cihazdaki gerçek akıştan gelir.</div>' +
        '<div class="tw"><table class="t"><thead><tr><th>Dönem</th><th class="n">Yeni üye</th>' +
        '<th class="n">Damga</th><th class="n">Ödül</th></tr></thead><tbody>' +
        satir.map(function (r) {
          return '<tr><td>' + r[0] + '</td><td class="n">' + r[1] + '</td><td class="n">' + r[2] +
            '</td><td class="n">' + r[3] + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<h2 style="font-size:1rem;margin:0 0 .5rem;color:var(--cocoa)">Nokta bazlı okutma</h2>' +
        '<div class="tw"><table class="t"><thead><tr><th>Nokta</th><th class="n">QR</th><th class="n">NFC</th></tr></thead><tbody>' +
        (S.cards || []).map(function (c) {
          return '<tr><td>' + c.etiket + ' <code>' + c.token + '</code></td><td class="n">' + c.qr +
            '</td><td class="n">' + c.nfc + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<button class="btn btn-sec" data-is="raporCsv">Raporu CSV indir</button>';
    }
  };
  ISLER.raporCsv = function (S) {
    csvIndir('pecko-rapor-' + P.today().replace(/\./g, '-') + '.csv',
      [['Dönem', 'Yeni üye', 'Damga', 'Ödül'], ['Bu hafta', uyeler(S).filter(function (x) { return x.gercek; }).length, bugunDamga(S), S.redeemed || 0]]);
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
      return '<div class="uyari">Kampanya izni veren, iznini geri alan ve üyeliğini silen her müşteri ' +
          'için bir kayıt kuyruğa girer. Mevzuat <b>3 iş günü</b> içinde bildirim ister.</div>' +
        '<dl class="tiles">' + kutu('Bekleyen', bekleyen.length) + kutu('Aktarılmış', kuyruk.length - bekleyen.length) + '</dl>' +
        (kuyruk.length ? '<div class="tw"><table class="t"><thead><tr><th>Alıcı</th><th>Tür</th><th>Kaynak</th><th>Durum</th></tr></thead><tbody>' +
          kuyruk.map(function (r) {
            return '<tr><td>' + r.alici + '</td><td>' + r.tur + '</td><td>' + r.kaynak + '</td><td>' +
              (r.aktarim ? '<span class="tag ok">aktarıldı</span>' : '<span class="tag bek">bekliyor</span>') + '</td></tr>';
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
