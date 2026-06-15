require("dotenv").config();
const fs = require("fs");
const path = require("path");

const APPSTATE_PATH = path.join(__dirname, "appstate.json");
const ASSETS_PATH = path.join(__dirname, "assets");
const MENUS_PATH = path.join(__dirname, "menus.json");

function loadMenuConfig() {
  if (fs.existsSync(MENUS_PATH)) {
    try { return JSON.parse(fs.readFileSync(MENUS_PATH, "utf8")); } catch (e) {}
  }
  return {
    menu1: { title: "📋 قائمة الاوامر 1", commands: require("./commands/menu1").getText() },
    menu2: { title: "🔥 قائمة الاوامر 2", commands: require("./commands/menu2").getText() },
    menu3: { title: "⚙️ قائمة الاوامر 3", commands: require("./commands/menu3").getText() },
    menu4: { title: "💫 قائمة الاوامر 4", commands: require("./commands/menu4").getText() },
  };
}

const menuKeys = {
  "الاوامر 1": { gif: path.join(ASSETS_PATH, "menu1.gif"), configKey: "menu1" },
  "الاوامر 2": { gif: path.join(ASSETS_PATH, "menu2.gif"), configKey: "menu2" },
  "الاوامر 3": { gif: path.join(ASSETS_PATH, "menu3.gif"), configKey: "menu3" },
  "الاوامر 4": { gif: path.join(ASSETS_PATH, "menu4.gif"), configKey: "menu4" },
};

const pendingMenuReply = {};
let api = null;

function loadAppState() {
  if (!fs.existsSync(APPSTATE_PATH)) {
    console.error("❌ appstate.json غير موجود! أضف ملف الكوكيز.");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(APPSTATE_PATH, "utf8"));
}

function saveAppState(newState) {
  fs.writeFileSync(APPSTATE_PATH, JSON.stringify(newState, null, 2));
  console.log("✅ تم تحديث الكوكيز");
}

function refreshCookies() {
  if (!api) return;
  try {
    const newState = api.getAppState();
    saveAppState(newState);
    console.log("🔄 تم تحديث الكوكيز تلقائياً");
  } catch (e) {
    console.error("❌ فشل تحديث الكوكيز:", e.message);
  }
}

function startBot() {
  let login;
  try {
    login = require("fca-unofficial");
  } catch (e) {
    console.error("❌ مكتبة fca-unofficial غير مثبتة على هذا الجهاز.");
    console.log("💡 قم بتشغيل البوت على Railway حيث تكون الحزم متاحة.");
    return;
  }

  const appState = loadAppState();

  login({ appState }, (err, fbApi) => {
    if (err) {
      console.error("❌ خطأ في تسجيل الدخول:", err);
      console.log("🔄 إعادة المحاولة بعد 30 ثانية...");
      setTimeout(startBot, 30000);
      return;
    }

    api = fbApi;
    api.setOptions({ listenEvents: true, logLevel: "silent" });
    saveAppState(api.getAppState());
    console.log("✅ البوت يعمل الآن!");

    setInterval(refreshCookies, 60 * 60 * 1000);

    api.listenMqtt((err, event) => {
      if (err) { console.error("❌ خطأ في الاستماع:", err); return; }
      if (event.type !== "message") return;

      const threadID = event.threadID;
      const body = (event.body || "").trim();

      if (menuKeys[body]) {
        const menuDef = menuKeys[body];
        api.sendMessage(
          { attachment: fs.createReadStream(menuDef.gif) },
          threadID,
          (err, messageInfo) => {
            if (err) { console.error("❌ خطأ إرسال GIF:", err); return; }
            pendingMenuReply[threadID] = {
              menuKey: body,
              gifMessageID: messageInfo.messageID,
            };
            console.log(`📨 تم إرسال GIF للمستخدم في ${threadID}`);
          }
        );
        return;
      }

      if (
        pendingMenuReply[threadID] &&
        event.messageReply &&
        event.messageReply.messageID === pendingMenuReply[threadID].gifMessageID
      ) {
        const pending = pendingMenuReply[threadID];
        const menuConfig = loadMenuConfig();
        const menuData = menuConfig[menuKeys[pending.menuKey].configKey];
        const text = `${menuData.title}\n\n${menuData.commands}`;

        api.sendMessage({ body: text }, threadID, (err) => {
          if (!err) console.log(`📋 تم إرسال الأوامر لـ ${threadID}`);
        });

        delete pendingMenuReply[threadID];
      }
    });
  });
}

module.exports = { startBot };

if (require.main === module) {
  startBot();
}
