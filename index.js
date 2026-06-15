require("dotenv").config();
const fs = require("fs");
const path = require("path");
const login = require("fca-unofficial");
const cron = require("node-cron");

const APPSTATE_PATH = path.join(__dirname, "appstate.json");
const ASSETS_PATH = path.join(__dirname, "assets");

const menus = {
  "الاوامر 1": {
    gif: path.join(ASSETS_PATH, "menu1.gif"),
    title: "📋 قائمة الاوامر 1",
    commands: require("./commands/menu1"),
  },
  "الاوامر 2": {
    gif: path.join(ASSETS_PATH, "menu2.gif"),
    title: "📋 قائمة الاوامر 2",
    commands: require("./commands/menu2"),
  },
  "الاوامر 3": {
    gif: path.join(ASSETS_PATH, "menu3.gif"),
    title: "📋 قائمة الاوامر 3",
    commands: require("./commands/menu3"),
  },
  "الاوامر 4": {
    gif: path.join(ASSETS_PATH, "menu4.gif"),
    title: "📋 قائمة الاوامر 4",
    commands: require("./commands/menu4"),
  },
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

function startBot() {
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

    api.listenMqtt((err, event) => {
      if (err) {
        console.error("❌ خطأ في الاستماع:", err);
        return;
      }

      if (event.type !== "message") return;

      const threadID = event.threadID;
      const senderID = event.senderID;
      const body = (event.body || "").trim();

      if (menus[body]) {
        const menu = menus[body];

        api.sendMessage(
          {
            attachment: fs.createReadStream(menu.gif),
          },
          threadID,
          (err, messageInfo) => {
            if (err) {
              console.error("❌ خطأ في إرسال GIF:", err);
              return;
            }
            pendingMenuReply[threadID] = {
              menuKey: body,
              gifMessageID: messageInfo.messageID,
              senderID,
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
        const menu = menus[pending.menuKey];
        const commandsText = menu.commands.getText();

        api.sendMessage(
          {
            body: `${menu.title}\n\n${commandsText}`,
          },
          threadID,
          (err) => {
            if (!err) {
              console.log(`📋 تم إرسال قائمة الأوامر لـ ${threadID}`);
            }
          }
        );

        delete pendingMenuReply[threadID];
        return;
      }
    });
  });
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

cron.schedule("0 * * * *", () => {
  console.log("⏰ تحديث الكوكيز تلقائياً...");
  refreshCookies();
});

startBot();
