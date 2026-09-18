/* Üye uygulaması provası.
 *
 * Ürünle aynı ekranlar, aynı stil dosyası; veriler tarayıcıdaki prova
 * durumundan geliyor. Sunucu yok, bu yüzden "oturum" da yok: uygulamanın
 * kalıcı girişini burada localStorage temsil ediyor.
 */
(function () {
  'use strict';
  var P = window.PECKO;
  var $ = function (id) { return document.getElementById(id); };
  var S = P.load();

  // [bölüm kimliği, sayfa başlığı] — sekme çubuğundaki kısa ad HTML'de duruyor.
  var SEKME = {
    kart: ['s-kart', 'Kartım'],
    gecmis: ['s-gecmis', 'Geçmiş'],
    fis: ['s-fis', 'Fiş yükle'],
    hesap: ['s-hesap', 'Hesabım'],
  };

  function el(etiket, sinif, metin) {
    var e = document.createElement(etiket);
    if (sinif) e.className = sinif;
    if (metin != null) e.textContent = metin;
    return e;
  }

  // Boş liste: kartın içinde tek cümle değil, simgesiyle birlikte bir durum.
  function bosDurum(yol, baslik, alt) {
    var g = el('div', 'grup'), b = el('div', 'bos');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" '
      + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + yol + '</svg>';
    b.appendChild(el('p', 'baslik', baslik));
    b.appendChild(el('p', 'alt', alt));
    g.appendChild(b);
    return g;
  }

  var SIMGE_TORBA = '<path d="M6 8h12l-1 12H7z"/><path d="M9.2 8V6.6a2.8 2.8 0 0 1 5.6 0V8"/>';
  var SIMGE_HEDIYE = '<path d="M4.6 11.4h14.8V20H4.6z"/><path d="M3.6 7.6h16.8v3.8H3.6z"/><path d="M12 7.6V20"/>'
    + '<path d="M12 7.6S10.8 4 8.8 4a1.9 1.9 0 0 0 0 3.6z"/><path d="M12 7.6S13.2 4 15.2 4a1.9 1.9 0 0 1 0 3.6z"/>';
  var SIMGE_FIS = '<path d="M6 3.8h12v16.4l-2.4-1.5-2.4 1.5-2.4-1.5-2.4 1.5L6 18.7z"/><path d="M9.4 8.6h5.2"/><path d="M9.4 12.4h5.2"/>';

  /* --- iki yanlı liste satırı --- */
  function satir(baslik, alt, sagBaslik, sagAlt) {
    var li = el('li');
    var sol = el('span', 'sol');
    sol.appendChild(el('span', 'baslik', baslik));
    if (alt) sol.appendChild(el('span', 'alt', alt));
    li.appendChild(sol);
    if (sagBaslik != null) {
      var sag = el('span', 'sag');
      sag.appendChild(el('span', 'baslik', sagBaslik));
      if (sagAlt) sag.appendChild(el('span', 'alt', sagAlt));
      li.appendChild(sag);
    }
    return li;
  }

  /* --- ekranlar --- */

  function kartCiz() {
    var tur = P.turDurumu(S), c = P.CUZDAN;
    $('kod').textContent = S.code || '—';

    var kap = $('tur-noktalar');
    kap.innerHTML = '';
    for (var i = 0; i < tur.uzunluk; i++) {
      var n = el('span');
      if (i < tur.alisveris) n.className = 'dolu';
      kap.appendChild(n);
    }
    kap.setAttribute('aria-label', tur.alisveris + ' / ' + tur.uzunluk + ' alışveriş');
    $('tur-sayi').textContent = tur.alisveris + ' / ' + tur.uzunluk + ' alışveriş';
    $('tur-kalan').textContent = tur.kalan ? tur.kalan + ' alışveriş kaldı' : 'Tur doldu';

    var bakiye = P.aktifBakiye(S), bekleyen = P.bekleyenBakiye(S), ilk = P.ilkSonKullanma(S);
    $('bakiye').textContent = P.tlk(bakiye);
    $('bakiye-skt').hidden = !ilk;
    if (ilk) $('bakiye-skt').textContent = 'Son kullanma ' + P.gunAdi(P.gunKodu(ilk.sonKullanmaTs));
    $('bakiye-bekleyen').hidden = !bekleyen;
    if (bekleyen) $('bakiye-bekleyen').textContent = P.tlk(bekleyen) + ' bugün kazanıldı, yarından itibaren kullanılabilir.';
    $('tavan-not').textContent = 'Bakiyeniz bir alışverişin en fazla %' + Math.round(c.tavanOrani * 100)
      + "'ini karşılar; nakde çevrilmez.";

    var adimlar = [
      [c.turUzunlugu + ' alışveriş yapın',
        'Aynı gündeki fişler tek alışveriş sayılır; günlük toplam ' + P.tlkKisa(c.enAzAlisverisKurus) + ' ve üzeri olmalıdır.'],
      ["Tur dolunca %" + Math.round(c.oran * 100) + "'i size döner",
        'O turda ödediğiniz tutarın %' + Math.round(c.oran * 100) + "'i hediye bakiye olarak hesabınıza geçer."],
      [c.gecerlilikGun + ' gün içinde harcayın',
        'Kasada kodunuzu söylemeniz yeterli; bakiyeniz alışverişten düşülür.'],
    ];
    var ol = $('adimlar');
    ol.innerHTML = '';
    adimlar.forEach(function (a, i) {
      var li = el('li');
      li.appendChild(el('b', null, String(i + 1)));
      var s = el('span');
      s.appendChild(el('span', 'baslik', a[0]));
      s.appendChild(el('span', 'alt', a[1]));
      li.appendChild(s);
      ol.appendChild(li);
    });
  }

  function gecmisCiz() {
    var kap = $('alisverisler');
    kap.innerHTML = '';
    var liste = S.alisverisler || [];
    if (!liste.length) {
      kap.appendChild(bosDurum(SIMGE_TORBA, 'Henüz alışveriş yok',
        'İlk alışverişiniz kasada işlendiğinde burada görünür.'));
    } else {
      var ul = el('ul', 'liste grup'), oncekiTur = null;
      liste.forEach(function (a) {
        if (a.sayildi && a.turNo !== oncekiTur) {
          var ay = el('li', 'ayirac', 'Tur ' + a.turNo);
          ul.appendChild(ay);
          oncekiTur = a.turNo;
        }
        var notlar = [];
        if (!a.sayildi) notlar.push('Tura sayılmadı');
        if (a.fis > 1) notlar.push(a.fis + ' fiş birleşti');
        ul.appendChild(satir(P.gunAdi(a.gun), notlar.join(' · '), P.tlk(a.netKurus),
          a.bakiyeKurus ? 'bakiye ' + P.tlk(a.bakiyeKurus) : null));
      });
      kap.appendChild(ul);
    }

    var kap2 = $('partiler');
    kap2.innerHTML = '';
    var partiler = (S.cuzdan && S.cuzdan.partiler) || [];
    if (!partiler.length) {
      kap2.appendChild(bosDurum(SIMGE_HEDIYE, 'Hediye bakiyeniz burada birikir',
        P.CUZDAN.turUzunlugu + ' alışverişi tamamladığınızda ilk bakiyeniz bu listeye düşer.'));
    } else {
      var ul2 = el('ul', 'liste grup');
      partiler.forEach(function (p) {
        var durum = p.kalan > 0 && p.sonKullanmaTs > Date.now() ? P.tlk(p.kalan) + ' kaldı'
          : (p.kalan > 0 ? 'süresi doldu' : 'kullanıldı');
        ul2.appendChild(satir(
          p.turNo ? 'Tur ' + p.turNo : (p.sebep === 'instagram' ? 'Instagram paylaşımı' : 'Hediye bakiye'),
          P.gunAdi(P.gunKodu(p.kazanildiTs)) + ' · son kullanma ' + P.gunAdi(P.gunKodu(p.sonKullanmaTs)),
          P.tlk(p.tutar), durum));
      });
      kap2.appendChild(ul2);
    }
  }

  var DURUM_ADI = { 'onaylandı': ['olumlu', 'Onaylandı'], 'bekliyor': ['bekliyor', 'İnceleniyor'], 'reddedildi': ['', 'Reddedildi'] };

  function fisCiz() {
    var kap = $('fisler');
    kap.innerHTML = '';
    var liste = S.receipts || [];
    if (!liste.length) {
      kap.appendChild(bosDurum(SIMGE_FIS, 'Henüz fiş göndermediniz',
        'Gönderdiğiniz fişlerin durumunu bu listeden takip edersiniz.'));
      return;
    }
    var ul = el('ul', 'liste grup');
    liste.forEach(function (r) {
      var d = DURUM_ADI[r.durum] || ['', r.durum];
      var li = el('li');
      var sol = el('span', 'sol');
      sol.appendChild(el('span', 'baslik', r.tutar ? P.tl(r.tutar) : 'Tutar okunuyor'));
      sol.appendChild(el('span', 'alt', r.t.split(' ')[0] + (r.durum === 'reddedildi' && r.sebep ? ' · ' + r.sebep : '')));
      li.appendChild(sol);
      var sag = el('span', 'sag');
      sag.appendChild(el('span', 'rozet ' + d[0], d[1]));
      li.appendChild(sag);
      ul.appendChild(li);
    });
    kap.appendChild(ul);
  }

  function hesapCiz() {
    $('h-kod').textContent = S.code || '—';
    $('h-tel').textContent = S.phone ? P.telMaske(S.phone) : '—';
    $('h-tarih').textContent = S.activatedAt ? String(S.activatedAt).split(' ')[0] : '—';
    $('izin').checked = !!S.marketing;
    $('cihaz-zaman').textContent = 'Son kullanım ' + P.today() + ' ' + P.now();
    $('cihaz').textContent = P.cihazAdi() + ' · bu cihaz';
  }

  /* --- sekme geçişi --- */

  function git(ad) {
    if (!SEKME[ad]) ad = 'kart';
    Object.keys(SEKME).forEach(function (k) { $(SEKME[k][0]).hidden = k !== ad; });
    $('baslik').textContent = SEKME[ad][1];
    var baglar = $('sekmeler').querySelectorAll('a');
    for (var i = 0; i < baglar.length; i++) {
      var etkin = baglar[i].getAttribute('data-git') === ad;
      baglar[i].className = etkin ? 'acik' : '';
      if (etkin) baglar[i].setAttribute('aria-current', 'page');
      else baglar[i].removeAttribute('aria-current');
    }
    // Ürün, işletmenin sitesine /sadakat önekiyle bağlanıyor (BASE_URL'den
    // türetiliyor); adres çubuğu taklidi de onu göstersin.
    $('path').textContent = ad === 'kart' ? '/sadakat/uye' : '/sadakat/uye/' + ad;
    if (ad === 'kart') kartCiz();
    if (ad === 'gecmis') gecmisCiz();
    if (ad === 'fis') fisCiz();
    if (ad === 'hesap') hesapCiz();
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('[data-git]') : null;
    if (!a) return;
    e.preventDefault();
    location.hash = a.getAttribute('data-git');
    git(a.getAttribute('data-git'));
  });

  /* --- oturum --- */

  function uygulamayiAc() {
    $('giris').hidden = true;
    $('sekmeler').hidden = false;
    git((location.hash || '#kart').slice(1));
  }

  function girisiAc() {
    $('giris').hidden = false;
    $('sekmeler').hidden = true;
    Object.keys(SEKME).forEach(function (k) { $(SEKME[k][0]).hidden = true; });
    $('baslik').textContent = 'Giriş yapın';
    $('path').textContent = '/sadakat/uye/giris';
    // Önceki sürümde açılmış üyelikte şifre yok; boş formu göstermek kapalı bir
    // kapıdan başka bir şey olmaz.
    var sifresiz = S.status === 'active' && !S.sifre;
    $('sifresiz').hidden = !sifresiz;
    $('giris-form').hidden = sifresiz;
  }

  $('giris-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var tel = P.telTemiz(this.telefon.value);
    var sifre = this.sifre.value;
    var hata = $('giris-hata');
    // Kayıtlı numarayla kayıtsız numara aynı cevabı alır: numara sorgulanamaz.
    if (!tel || tel !== S.phone || !sifre || P.sifreOzet(sifre) !== S.sifre) {
      hata.textContent = 'Numara veya şifre hatalı.';
      hata.hidden = false;
      return;
    }
    hata.hidden = true;
    S.oturum = true;
    P.save(S);
    uygulamayiAc();
  });

  $('cikis').addEventListener('click', function () {
    S.oturum = false;
    P.save(S);
    girisiAc();
  });

  $('izin').addEventListener('change', function () {
    S.marketing = this.checked;
    P.event(S, 'Kampanya izni ' + (this.checked ? 'verildi' : 'geri alındı') + ' (uygulama)', 'izin', 0);
    P.save(S);
  });

  /* --- fiş provası --- */

  var secilenGorsel = null;
  $('fis-girdi').addEventListener('change', function () {
    var d = this.files && this.files[0];
    $('fis-ad').textContent = d ? d.name : 'Fişin fotoğrafını seçin';
    secilenGorsel = null;
    if (!d) return;
    var fr = new FileReader();
    fr.onload = function () { secilenGorsel = fr.result; };
    fr.readAsDataURL(d);
  });

  $('fis-gonder').addEventListener('click', function () {
    var kutu = $('fis-durum');
    function yaz(metin, sinif) {
      kutu.textContent = metin;
      kutu.className = 'uyari ' + sinif;
      kutu.hidden = false;
    }
    if (!$('fis-girdi').files || !$('fis-girdi').files[0]) {
      yaz('Önce fişin fotoğrafını seçin.', 'hata');
      return;
    }
    var okuma = P.fisOku(S, 'temiz', Date.now() % 1000000);
    var sonuc = P.fisGonder(S, okuma, secilenGorsel || P.fisGorseli(okuma));
    if (sonuc.durum === 'reddedildi') yaz(sonuc.sebep, 'hata');
    else if (sonuc.durum === 'bekliyor') yaz(sonuc.sebep || 'Fişiniz incelemeye alındı.', 'bilgi');
    else yaz('Fişiniz alındı: ' + P.tl(sonuc.fis.tutar) + '.', 'bilgi');
    P.save(S);
    $('fis-girdi').value = '';
    $('fis-ad').textContent = 'Fişin fotoğrafını seçin';
    secilenGorsel = null;
    fisCiz();
  });

  /* --- açılış --- */

  if (S.status === 'active' && S.code) {
    if (S.oturum === false) girisiAc();
    else { S.oturum = true; P.save(S); uygulamayiAc(); }
  } else {
    // Hiç üyelik yok: kayıt akışına gönder.
    location.replace('../onay/?yeni=1');
  }

  window.addEventListener('hashchange', function () {
    if (!$('sekmeler').hidden) git((location.hash || '#kart').slice(1));
  });
})();
