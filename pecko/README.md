# Peçko Sadakat – statik yedek açılış sayfası

Bu klasör, `Randomwebguy/Webtest` deposundaki sadakat sisteminin **sunucuya bağımlı olmayan** açılış sayfasıdır.
QR kod / NFC etiket bu sayfaya yönlendirilirse sadakat sunucusu kapalı olsa bile müşteri WhatsApp'a ulaşır;
mesaj Meta tarafından kuyruğa alınır ve sunucu açılınca işlenir.

Adres biçimi: `https://<pages-alan-adı>/pecko/?k=KASA1` (`k` = panelde tanımlı nokta kodu).

Kullanmadan önce `index.html` içindeki üç sabiti düzenleyin: `BUSINESS_PHONE` (905… biçiminde işletme WhatsApp numarası),
`BACKEND_URL` (sadakat sunucusunun adresi; KVKK metni oradan okunur) ve gerekiyorsa `BUSINESS_NAME`.

Asıl açılış sayfası sunucudadır (`/c/KASA1`): okutmaları sayar ve nokta kodunu doğrular. Bu statik sayfa yalnızca bir yedektir;
hangisinin QR'a basılacağına işletme karar verir (bkz. Webtest deposu, `docs/PLAN.md` C10).
