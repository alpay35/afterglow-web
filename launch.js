/* Açılış sayfası: payload'ı seç, sonra koşuyu başlat.
 *
 * Bu sayfadan ayrılmak gerçek bir yönlendirme olmalı: jb.js'teki referrer
 * kontrolü zinciri yalnızca koşu sayfasına buradan gelindiğinde kurar. */

var TARGET = {
  hen: "log=1&afterglow=run&payload=hen.bin",
  goldhen: "log=1&afterglow=run&mode=goldhen",
};

var AUTOSTART_SECONDS = 5;
var STORE_KEY = "afterglow.choice";

var form = document.getElementById("pick");
var autoBox = document.getElementById("auto");
var countEl = document.getElementById("count");
var cacheEl = document.getElementById("cache");
var ticker = null;
var waitingForCache = false;

/* Çevrimdışı önbellek ve koşunun başlamaması gereken tek durum.
 *
 * Manifest denetlenirken ya da indirilirken modüllerin bir kısmı sayfanın
 * açılışta yüklediği, bir kısmı ise henüz diskte olmayan sürümlerdir; orada
 * başlamak iki ayrı build'i karıştırır. Diğer bütün durumlar başlamak için
 * uygundur: IDLE önbellekli ve güncel, UNCACHED hiç önbellek yok (sunucu
 * yanıt verdikçe çalışır), Application Cache'i hiç olmayan bir tarayıcı ise
 * (Chrome 95'ten beri her masaüstü tarayıcısı) elbette başlayabilmeli.
 *
 * Yani yalnızca CHECKING ve DOWNLOADING durumlarında bekletilir. Tersi,
 * yani sadece IDLE'da izin vermek, önbelleğin olmadığı her yerde düğmeyi
 * ölü bırakır.
 *
 * Fikir titotryh-ux'un, Fewi-PS4 911e08a'dan. */
var appCache = (function () {
  try { return window.applicationCache || null; } catch (e) { return null; }
})();

function cacheBusy() {
  if (!appCache) return false;
  try {
    return appCache.status === appCache.CHECKING
        || appCache.status === appCache.DOWNLOADING;
  } catch (e) {
    return false;
  }
}

/* Önbellek durumu her zaman yazılır, boş bırakılmaz.
 *
 * Boş bırakıldığında "önbellekte" ile "hiç önbellek yok" birbirinden ayırt
 * edilemiyordu; ikisi de sessiz kalıyordu. Bu satır, konsolda tek bakışta
 * hangisinin geçerli olduğunu söyler:
 *   - "önbellek hazır"  -> tarayıcı dosyaları gerçekten sakladı
 *   - "önbellek yok"    -> her açılışta sunucudan iniyor
 *   - "desteklemiyor"   -> tarayıcıda Application Cache hiç yok
 */
function cacheNote() {
  if (!cacheEl) return;
  var text = "";
  if (!appCache) {
    text = "önbellek desteklenmiyor";
  } else {
    try {
      if (appCache.status === appCache.CHECKING) text = "önbellek denetleniyor";
      else if (appCache.status === appCache.DOWNLOADING) text = "dosyalar iniyor, bekle";
      else if (appCache.status === appCache.UPDATEREADY) text = "yeni sürüm önbellekte";
      else if (appCache.status === appCache.OBSOLETE) text = "önbellek düştü, doğrudan sunucudan";
      else if (appCache.status === appCache.IDLE) text = "önbellek hazır ve güncel";
      else if (appCache.status === appCache.UNCACHED) text = "önbellek yok, sunucudan";
    } catch (e) {
      text = "";
    }
  }
  cacheEl.textContent = text;
}

function cacheChanged() {
  cacheNote();
  /* Biri dosyalar hâlâ inerken başlata bastı. Dosyalar geldiğine göre şimdi
     git, bir daha basmasını bekleme. */
  if (waitingForCache && !cacheBusy()) {
    waitingForCache = false;
    start();
  }
}

if (appCache) {
  var events = ["checking", "downloading", "progress", "cached", "noupdate",
                "updateready", "error", "obsolete"];
  for (var e = 0; e < events.length; e++) {
    try { appCache.addEventListener(events[e], cacheChanged, false); } catch (err) {}
  }
}

/* Seçim localStorage'da hatırlanır, HTTP önbelleğinde değil: cache başlıkları
   bir dosyanın yeniden indirilip indirilmeyeceğini belirler, sayfanın neyi
   hatırladığını asla. İki erişim de korumalı, çünkü depolama kullanılamıyor
   olabilir ya da doğrudan fırlatabilir; sayfa her iki durumda da çalışmalı. */
function remember() {
  try {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ payload: picked(), autostart: autoBox.checked }),
    );
  } catch (e) {}
}

function restore() {
  var saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
  } catch (e) {}
  if (!saved) return;

  if (saved.payload && TARGET[saved.payload]) {
    var radio = form.querySelector(
      'input[name="payload"][value="' + saved.payload + '"]',
    );
    if (radio) radio.checked = true;
  }
  if (typeof saved.autostart === "boolean") autoBox.checked = saved.autostart;
}

function picked() {
  var radio = form.querySelector('input[name="payload"]:checked');
  return radio ? radio.value : "goldhen";
}

function start() {
  stopClock();
  /* Reddetme değil, bekleme: dosyalar inince koşu kendiliğinden başlar. */
  if (cacheBusy()) {
    waitingForCache = true;
    countEl.textContent = "önbellek bekleniyor";
    cacheNote();
    return;
  }
  location.href = "jb.html?" + TARGET[picked()];
}

function stopClock() {
  if (ticker !== null) {
    clearInterval(ticker);
    ticker = null;
  }
  countEl.textContent = "";
}

function startClock() {
  var left = AUTOSTART_SECONDS;
  countEl.textContent = left + " sn sonra başlıyor";
  ticker = setInterval(function () {
    left -= 1;
    if (left <= 0) {
      start();
      return;
    }
    countEl.textContent = left + " sn sonra başlıyor";
  }, 1000);
}

form.addEventListener("submit", function (ev) {
  ev.preventDefault();
  start();
});

form.addEventListener("change", function (ev) {
  remember();
  if (ev.target === autoBox) {
    if (autoBox.checked) startClock();
    else stopClock();
    return;
  }
  /* Geri sayım sürerken payload değiştirmek sayacı yeniden başlatır, böylece
     sayan şey her zaman gerçekten seçili olan olur. */
  if (ev.target.name === "payload" && autoBox.checked) {
    stopClock();
    startClock();
  }
});

restore();
cacheNote();
if (autoBox.checked) startClock();
