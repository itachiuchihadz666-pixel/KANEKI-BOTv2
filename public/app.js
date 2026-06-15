let pollInterval = null;

function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove("show"), 3000);
}

async function api(method, endpoint, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(endpoint, opts);
  return res.json();
}

async function fetchStatus() {
  try {
    const data = await api("GET", "/api/status");
    const dot = document.getElementById("statusDot");
    const txt = document.getElementById("statusText");
    const stat = document.getElementById("statStatus");
    const cook = document.getElementById("statCookies");
    const up = document.getElementById("statUptime");

    dot.className = "status-dot " + (data.status === "online" ? "online" : "offline");
    txt.textContent = data.status === "online" ? "البوت يعمل" : "البوت متوقف";
    stat.textContent = data.status === "online" ? "🟢 يعمل" : "🔴 متوقف";
    cook.textContent = data.hasCookies ? "✅ موجودة" : "❌ غير موجودة";
    up.textContent = formatUptime(data.uptime);

    document.getElementById("startBtn").disabled = data.status === "online";
    document.getElementById("stopBtn").disabled = data.status !== "online";
  } catch (e) {}
}

async function fetchLogs() {
  try {
    const logs = await api("GET", "/api/logs");
    const container = document.getElementById("logsContainer");
    if (!logs.length) {
      container.innerHTML = '<div class="log-empty">لا توجد أحداث بعد...</div>';
      return;
    }
    container.innerHTML = logs.map(l => {
      const time = new Date(l.time).toLocaleTimeString("ar-SA");
      return `<div class="log-entry ${l.type}">
        <span class="log-time">${time}</span>
        <span class="log-msg">${escapeHtml(l.message)}</span>
      </div>`;
    }).join("");
  } catch (e) {}
}

async function loadMenus() {
  try {
    const menus = await api("GET", "/api/menus");
    for (let i = 1; i <= 4; i++) {
      const key = `menu${i}`;
      if (menus[key]) {
        document.getElementById(`title${i}`).value = menus[key].title || "";
        document.getElementById(`cmds${i}`).value = menus[key].commands || "";
      }
    }
  } catch (e) {}
}

async function saveMenus() {
  const menus = {};
  for (let i = 1; i <= 4; i++) {
    menus[`menu${i}`] = {
      title: document.getElementById(`title${i}`).value,
      commands: document.getElementById(`cmds${i}`).value
    };
  }
  const res = await api("POST", "/api/menus", menus);
  if (res.ok) showToast("✅ تم حفظ القوائم", "success");
  else showToast("❌ فشل الحفظ", "error");
}

async function uploadCookies() {
  const cookies = document.getElementById("cookiesInput").value.trim();
  if (!cookies) return showToast("الصق الكوكيز أولاً", "error");
  const res = await api("POST", "/api/cookies", { cookies });
  if (res.ok) {
    showToast("✅ تم رفع الكوكيز", "success");
    document.getElementById("cookiesInput").value = "";
    fetchStatus();
  } else showToast("❌ " + (res.error || "فشل الرفع"), "error");
}

async function deleteCookies() {
  if (!confirm("هل تريد حذف الكوكيز؟")) return;
  const res = await api("DELETE", "/api/cookies");
  if (res.ok) { showToast("تم حذف الكوكيز", "info"); fetchStatus(); }
}

async function startBot() {
  const res = await api("POST", "/api/bot/start");
  if (res.ok) { showToast("🚀 تم تشغيل البوت", "success"); fetchStatus(); fetchLogs(); }
  else showToast("❌ " + (res.error || "فشل التشغيل"), "error");
}

async function stopBot() {
  const res = await api("POST", "/api/bot/stop");
  if (res.ok) { showToast("🛑 تم إيقاف البوت", "info"); fetchStatus(); }
}

function clearLogs() {
  document.getElementById("logsContainer").innerHTML = '<div class="log-empty">تم مسح السجل</div>';
}

function switchTab(num, el) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".menu-panel").forEach(p => p.classList.remove("active"));
  el.classList.add("active");
  document.getElementById(`panel${num}`).classList.add("active");
}

function formatUptime(s) {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}س ${m}د`;
  if (m > 0) return `${m}د ${sec}ث`;
  return `${sec}ث`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function init() {
  fetchStatus();
  fetchLogs();
  loadMenus();
  pollInterval = setInterval(() => { fetchStatus(); fetchLogs(); }, 5000);
}

document.addEventListener("DOMContentLoaded", init);
