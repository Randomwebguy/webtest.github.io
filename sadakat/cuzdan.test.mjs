import fs from 'node:fs';
import assert from 'node:assert/strict';

// ortak.js'i tarayıcısız çalıştır
const kod = fs.readFileSync(new URL('./ortak.js', import.meta.url), 'utf8');
const w = { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }, crypto: undefined };
new Function('window', 'document', 'getComputedStyle', 'Image', kod)(w, { querySelectorAll: () => [] }, () => ({ getPropertyValue: () => '' }), function () {});
const P = w.PECKO;

const GUN = 86400000;
function yeniUye() { return { code: 'PK-TEST-001', status: 'active', events: [], log: [] }; }
const gecti = [];
function t(ad, fn) { try { fn(); gecti.push('✓ ' + ad); } catch (e) { console.log('✗ ' + ad + '\n   ' + e.message); process.exitCode = 1; } }

t('10 alışveriş → net toplamın %5\'i bakiye', () => {
  const s = yeniUye();
  let son;
  for (let i = 0; i < 10; i++) {
    son = P.alisverisEkle(s, { brutKurus: 30000, ts: Date.now() - (10 - i) * GUN });  // 300 TL × 10 = 3.000 TL
  }
  assert.ok(son.parti, 'tur kapanmalı');
  assert.equal(son.parti.tutar, 15000, '3.000 TL → 150 TL');       // işletmenin örneği
  assert.equal(P.aktifBakiye(s), 15000);
  assert.equal(P.turDurumu(s).no, 2, 'yeni tur başlamalı');
  assert.equal(P.turDurumu(s).alisveris, 0);
});

t('işletmenin üç örneği birebir tutuyor', () => {
  for (const [toplam, beklenen] of [[3000, 150], [5000, 250], [10000, 500]]) {
    const s = yeniUye();
    let son;
    for (let i = 0; i < 10; i++) son = P.alisverisEkle(s, { brutKurus: P.kurus(toplam / 10), ts: Date.now() - (10 - i) * GUN });
    assert.equal(son.parti.tutar, P.kurus(beklenen), toplam + ' TL → ' + beklenen + ' TL');
  }
});

t('aynı gün ikinci fiş yeni alışveriş açmaz, tutar toplanır', () => {
  const s = yeniUye();
  const ts = Date.now();
  const a = P.alisverisEkle(s, { brutKurus: 20000, ts });
  const b = P.alisverisEkle(s, { brutKurus: 15000, ts: ts + 3600000 });   // aynı gün
  assert.equal(a.sayildi, true);
  assert.equal(b.sayildi, false, 'ikinci fiş yeni alışveriş saymaz');
  assert.equal(P.turDurumu(s).alisveris, 1);
  assert.equal(P.turDurumu(s).netKurus, 35000, 'tutarlar toplanır');
  assert.equal(s.alisverisler.length, 1, 'tek gün kaydı');
});

t('alt sınırın altındaki gün alışveriş sayılmaz', () => {
  const s = yeniUye();
  const r = P.alisverisEkle(s, { brutKurus: 5000, ts: Date.now() });   // 50 TL < 75 TL
  assert.equal(r.sayildi, false);
  assert.equal(P.turDurumu(s).alisveris, 0);
  // aynı gün ek alışverişle sınır aşılınca sayılır
  const r2 = P.alisverisEkle(s, { brutKurus: 3000, ts: Date.now() + 1000 });  // toplam 80 TL
  assert.equal(r2.sayildi, true);
  assert.equal(P.turDurumu(s).alisveris, 1);
});

t('bakiye tavanı brüt tutarın %25\'i', () => {
  const s = yeniUye();
  for (let i = 0; i < 10; i++) P.alisverisEkle(s, { brutKurus: 100000, ts: Date.now() - (10 - i) * GUN }); // 10.000 TL
  assert.equal(P.aktifBakiye(s), 50000, '500 TL bakiye');
  assert.equal(P.kullanilabilir(s, 200000), 50000, '2.000 TL fişte tamamı');
  assert.equal(P.kullanilabilir(s, 100000), 25000, '1.000 TL fişte yarısı');
  assert.equal(P.kullanilabilir(s, 40000), 10000, '400 TL fişte 100 TL');
});

t('bakiyeyle ödenen kısım yeni harcamaya sayılmaz', () => {
  const s = yeniUye();
  for (let i = 0; i < 10; i++) P.alisverisEkle(s, { brutKurus: 100000, ts: Date.now() - (20 - i) * GUN });
  assert.equal(P.aktifBakiye(s), 50000);
  const r = P.alisverisEkle(s, { brutKurus: 200000, bakiyeKurus: 50000, ts: Date.now() });
  assert.equal(P.aktifBakiye(s), 0, 'bakiye tükendi');
  assert.equal(P.turDurumu(s).netKurus, 150000, 'yalnızca ödenen 1.500 TL sayılır');
});

t('bakiye 30 gün sonra ölür', () => {
  const s = yeniUye();
  const eski = Date.now() - 40 * GUN;
  for (let i = 0; i < 10; i++) P.alisverisEkle(s, { brutKurus: 30000, ts: eski - (10 - i) * GUN });
  assert.equal(P.aktifBakiye(s, eski + GUN), 15000, 'kazanıldığı gün geçerli');
  assert.equal(P.aktifBakiye(s), 0, '40 gün sonra ölmüş');
  assert.equal(P.kullanilabilir(s, 200000), 0);
});

t('önce en yakın sona erecek parti düşer', () => {
  const s = yeniUye();
  P.bakiyeVer(s, 10000, 'ig', Date.now() - 25 * GUN);   // 5 gün ömrü kaldı
  P.bakiyeVer(s, 10000, 'ig2', Date.now() - GUN);       // 29 gün ömrü var
  P.alisverisEkle(s, { brutKurus: 100000, bakiyeKurus: 15000, ts: Date.now() });
  const p = s.cuzdan.partiler;
  assert.equal(p[0].kalan, 0, 'eski parti önce tükenir');
  assert.equal(p[1].kalan, 5000);
});

t('iade günü alt sınırın altına indirirse alışveriş sayısı düşer', () => {
  const s = yeniUye();
  const ts = Date.now();
  P.alisverisEkle(s, { brutKurus: 20000, ts: ts - 2 * GUN });
  P.alisverisEkle(s, { brutKurus: 10000, ts });
  assert.equal(P.turDurumu(s).alisveris, 2);
  const r = P.iadeEkle(s, { tutarKurus: 5000, ts });   // 100 → 50 TL
  assert.equal(r.ok, true);
  assert.equal(r.sayimDustu, true);
  assert.equal(P.turDurumu(s).alisveris, 1);
  assert.equal(P.turDurumu(s).netKurus, 25000);
});

t('kapanmış turdan iade kazanılan bakiyeyi kısar', () => {
  const s = yeniUye();
  const ts = Date.now();
  for (let i = 0; i < 10; i++) P.alisverisEkle(s, { brutKurus: 30000, ts: ts - (10 - i) * GUN });
  assert.equal(P.aktifBakiye(s), 15000);
  const r = P.iadeEkle(s, { tutarKurus: 30000, ts: ts - GUN });   // son günün tamamı iade
  assert.equal(r.ok, true);
  assert.equal(r.bakiyeKesinti, 1500, '300 TL iadenin %5\'i');
  assert.equal(P.aktifBakiye(s), 13500);
});

t('aynı gün ek harcama kapanmış turun ödülünü yeniden hesaplar', () => {
  const s = yeniUye();
  const ts = Date.now();
  for (let i = 0; i < 10; i++) P.alisverisEkle(s, { brutKurus: 30000, ts: ts - (10 - i) * GUN });
  assert.equal(P.aktifBakiye(s), 15000);
  P.alisverisEkle(s, { brutKurus: 20000, ts: ts - GUN + 3600000 });   // 10. günün aynı gününe ek
  assert.equal(P.aktifBakiye(s), 16000, '3.200 TL → 160 TL');
  assert.equal(P.turDurumu(s).alisveris, 0, 'yeni tur etkilenmez');
});

t('tahmini bakiye müşteriye doğru sayıyı gösterir', () => {
  const s = yeniUye();
  for (let i = 0; i < 4; i++) P.alisverisEkle(s, { brutKurus: 25000, ts: Date.now() - (4 - i) * GUN });
  const tur = P.turDurumu(s);
  assert.equal(tur.alisveris, 4);
  assert.equal(tur.kalan, 6);
  assert.equal(tur.netKurus, 100000);
  assert.equal(tur.tahminiBakiyeKurus, 5000, '1.000 TL harcamanın %5\'i');
});


t('bugün kazanılan bakiye bugün harcanamaz (11. alışveriş kuralı)', () => {
  const s = yeniUye();
  const ts = Date.now();
  for (let i = 0; i < 9; i++) P.alisverisEkle(s, { brutKurus: 30000, ts: ts - (10 - i) * GUN });
  const son = P.alisverisEkle(s, { brutKurus: 30000, ts });       // 10. alışveriş, bugün
  assert.ok(son.parti, 'tur kapandı');
  assert.equal(P.aktifBakiye(s), 15000, 'bakiye tanımlandı');
  assert.equal(P.bekleyenBakiye(s), 15000, 'tamamı bugün kazanıldı');
  assert.equal(P.kullanilabilir(s, 200000), 0, 'bugün harcanamaz');
  // Yarın kullanılabilir.
  assert.equal(P.kullanilabilir(s, 200000, ts + GUN), 15000);
});

t('bugün kazanılan bakiye harcama sırasında da atlanır', () => {
  const s = yeniUye();
  const ts = Date.now();
  P.bakiyeVer(s, 20000, 'eski', ts - 5 * GUN);
  P.bakiyeVer(s, 10000, 'bugun', ts);
  assert.equal(P.aktifBakiye(s), 30000);
  assert.equal(P.kullanilabilir(s, 400000), 20000, 'yalnızca eski parti');
  P.alisverisEkle(s, { brutKurus: 400000, bakiyeKurus: 20000, ts });
  const p = s.cuzdan.partiler;
  assert.equal(p[0].kalan, 0, 'eski parti tükendi');
  assert.equal(p[1].kalan, 10000, 'bugünkü parti dokunulmadı');
});

console.log(gecti.join('\n'));
console.log(gecti.length + ' test geçti');
