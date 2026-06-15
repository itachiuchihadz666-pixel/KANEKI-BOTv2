require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const http = require("http");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const APPSTATE_PATH = path.join(__dirname, "appstate.json");
const LOGS_PATH = path.join(__dirname, "logs.json");
const MENUS_PATH = path.join(__dirname, "menus.json");

app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

let botProcess = null;
let botStatus = "offline";
let logs = [];

function addLog(type, message) {
  const entry = { type, message, time: new Date().toISOString() };
  logs.unshift(entry);
  if (logs.length > 100) logs = logs.slice(0, 100);
  try { fs.writeFileSync(LOGS_PATH, JSON.stringify(logs)); } catch (e) {}
}

if (fs.existsSync(LOGS_PATH)) {
  try { logs = JSON.parse(fs.readFileSync(LOGS_PATH, "utf8")); } catch (e) { logs = []; }
}

function getDefaultMenus() {
  return {
    menu1: {
      title: "📋 قائمة الاوامر 1",
      commands: "/مساعدة - مساعدة\n/معلومات - معلومات\n/بينغ - اختبار\n/هلا - ترحيب\n/وقت - الوقت"
    },
    menu2: {
      title: "🔥 قائمة الاوامر 2",
      commands: "/العاب - الألعاب\n/زهر - نرد\n/عشوائي - رقم عشوائي\n/تخمين - تخمين عدد\n/مسابقة - مسابقة"
    },
    menu3: {
      title: "⚙️ قائمة الاوامر 3",
      commands: "/مشرف - مشرفون\n/كتم - كتم عضو\n/طرد - طرد عضو\n/ترحيب - رسالة ترحيب\n/قواعد - قواعد المجموعة"
    },
    menu4: {
      title: "💫 قائمة الاوامر 4",
      commands: "/طقس - حالة الطقس\n/ترجمة - ترجمة نص\n/بحث - بحث في غوغل\n/صورة - صورة عشوائية\n/نكتة - نكتة مضحكة"
    }
  };
}

function loadMenus() {
  if (fs.existsSync(MENUS_PATH)) {
    try { return JSON.parse(fs.readFileSync(MENUS_PATH, "utf8")); } catch (e) {}
  }
  return getDefaultMenus();
}

app.get("/api/status", (req, res) => {
  res.json({
    status: botStatus,
    hasCookies: fs.existsSync(APPSTATE_PATH),
    uptime: process.uptime()
  });
});

app.get("/api/logs", (req, res) => {
  res.json(logs.slice(0, 50));
});

app.get("/api/menus", (req, res) => {
  res.json(loadMenus());
});

app.post("/api/menus", (req, res) => {
  const menus = req.body;
  fs.writeFileSync(MENUS_PATH, JSON.stringify(menus, null, 2));
  addLog("info", "✏️ تم تحديث قوائم الأوامر");
  res.json({ ok: true });
});

app.post("/api/cookies", (req, res) => {
  const { cookies } = req.body;
  if (!cookies) return res.status(400).json({ error: "الكوكيز فارغة" });
  try {
    JSON.parse(cookies);
    fs.writeFileSync(APPSTATE_PATH, cookies);
    addLog("success", "🍪 تم رفع الكوكيز بنجاح");
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: "تنسيق JSON غير صحيح" });
  }
});

app.delete("/api/cookies", (req, res) => {
  if (fs.existsSync(APPSTATE_PATH)) {
    fs.unlinkSync(APPSTATE_PATH);
    addLog("warning", "🗑️ تم حذف الكوكيز");
  }
  res.json({ ok: true });
});

app.post("/api/bot/start", (req, res) => {
  if (!fs.existsSync(APPSTATE_PATH)) {
    return res.status(400).json({ error: "يجب رفع الكوكيز أولاً" });
  }
  if (botStatus === "online") {
    return res.json({ ok: true, message: "البوت يعمل بالفعل" });
  }

  try {
    const { fork } = require("child_process");
    botProcess = fork(path.join(__dirname, "index.js"), [], {
      env: { ...process.env },
      silent: true
    });

    botProcess.stdout.on("data", (data) => {
      addLog("info", data.toString().trim());
    });

    botProcess.stderr.on("data", (data) => {
      addLog("error", data.toString().trim());
    });

    botProcess.on("exit", (code) => {
      botStatus = "offline";
      addLog("warning", `⚠️ البوت توقف (كود: ${code})`);
    });

    botStatus = "online";
    addLog("success", "🚀 تم تشغيل البوت");
    res.json({ ok: true });
  } catch (e) {
    addLog("error", `❌ فشل تشغيل البوت: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/bot/stop", (req, res) => {
  if (botProcess) {
    botProcess.kill("SIGTERM");
    botProcess = null;
  }
  botStatus = "offline";
  addLog("warning", "🛑 تم إيقاف البوت");
  res.json({ ok: true });
});

server.listen(PORT, "0.0.0.0", () => {
  addLog("info", `🌐 لوحة التحكم تعمل على المنفذ ${PORT}`);
  console.log(`✅ Dashboard running on port ${PORT}`);
});
