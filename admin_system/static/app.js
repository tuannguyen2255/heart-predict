/* app.js — HeartGuard Admin Control Center Frontend Logic */
(() => {
  const TOKEN_KEY = "hg_admin_token";
  const USER_KEY = "hg_admin_user";

  let currentLogCategory = "guardrail";

  const $ = (id) => document.getElementById(id);

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function setSession(token, username) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, username);
    $("admin-badge").textContent = `👤 Admin: ${username}`;
  }

  function showToast(msg, isError = false) {
    const el = $("toast-banner");
    el.textContent = msg;
    el.className = `rounded-xl border px-4 py-3 text-xs font-semibold shadow-sm ${
      isError
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800"
    }`;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 5000);
  }

  async function apiFetch(path, options = {}) {
    const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(path, Object.assign({}, options, { headers }));
    if (res.status === 401 || res.status === 403) {
      $("login-modal").classList.remove("hidden");
      $("login-modal").classList.add("flex");
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Vui lòng đăng nhập quyền Quản trị viên.");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || `Lỗi HTTP ${res.status}`);
    }
    return data;
  }

  function escapeHtml(val) {
    return String(val ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("vi-VN");
    } catch {
      return iso;
    }
  }

  // ── 1. Load Overview & Funnel ──────────────────────────────────────────────
  async function loadOverview() {
    const data = await apiFetch("/api/admin/overview");
    const k = data.kpis;
    const ctrl = data.runtime_control;

    // Header status pills
    const chatPill = $("status-pill-chat");
    chatPill.textContent = ctrl.chatbot_disabled ? "Chatbot: ĐÃ TẠM DỪNG" : `Chatbot: BẬT (${ctrl.hourly_chat_limit}/giờ)`;
    chatPill.className = `rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
      ctrl.chatbot_disabled ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
    }`;

    const regPill = $("status-pill-reg");
    regPill.textContent = ctrl.registration_disabled ? "Đăng ký: ĐÃ KHÓA" : `Đăng ký: MỞ (${k.total_users}/${k.max_pilot_users || "∞"})`;
    regPill.className = `rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
      ctrl.registration_disabled ? "border-amber-200 bg-amber-50 text-amber-800" : "border-sky-200 bg-sky-50 text-sky-700"
    }`;

    // Pending deletions badge on tab
    const delBadge = $("badge-pending-deletions");
    if (k.pending_deletions > 0) {
      delBadge.textContent = k.pending_deletions;
      delBadge.classList.remove("hidden");
    } else {
      delBadge.classList.add("hidden");
    }

    // KPI Cards
    const cards = [
      {
        title: "Người dùng Pilot đã đăng ký",
        value: `${k.total_users} / ${k.max_pilot_users || "∞"}`,
        sub: `${k.consented_users} người đã xác nhận điều khoản ${data.system_info.current_terms_version}`,
        tone: "border-sky-200 bg-white",
      },
      {
        title: "Yêu cầu xóa chờ duyệt (24h)",
        value: k.pending_deletions,
        sub: k.overdue_deletions > 0 ? `⚠️ ${k.overdue_deletions} yêu cầu đã quá hạn 24h!` : "Tất cả đang trong hạn 24 giờ",
        tone: k.pending_deletions > 0 ? "border-rose-300 bg-rose-50/40" : "border-slate-200 bg-white",
      },
      {
        title: "Tổng lượt Đánh giá đã lưu",
        value: k.total_predictions,
        sub: "Lưu trong MySQL prediction_history & JSON log",
        tone: "border-slate-200 bg-white",
      },
      {
        title: "Tổng câu hỏi Trợ lý AI Chatbot",
        value: k.total_user_chats,
        sub: `Giới hạn hiện tại: ${ctrl.hourly_chat_limit} câu/giờ`,
        tone: "border-slate-200 bg-white",
      },
      {
        title: "Lượt Guardrail Chặn câu hỏi nguy hiểm",
        value: `${k.guardrail_blocks_today} hôm nay`,
        sub: `Tổng tích lũy: ${k.guardrail_blocks_total} lượt chặn thuốc/cấp cứu/injection`,
        tone: "border-amber-200 bg-white",
      },
      {
        title: "Nhật ký Đăng nhập hôm nay",
        value: `${k.logins_today} lượt`,
        sub: k.failed_logins_today > 0 ? `⚠️ ${k.failed_logins_today} lượt sai mật khẩu` : "0 lượt đăng nhập thất bại",
        tone: "border-slate-200 bg-white",
      },
    ];

    $("kpi-grid").innerHTML = cards
      .map(
        (c) => `
      <div class="rounded-2xl border ${c.tone} p-5 shadow-sm">
        <p class="text-xs font-semibold text-slate-500">${escapeHtml(c.title)}</p>
        <p class="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-900">${escapeHtml(c.value)}</p>
        <p class="mt-1 text-[11px] text-slate-500">${escapeHtml(c.sub)}</p>
      </div>`
      )
      .join("");

    $("pilot-cap-label").textContent = `Mục tiêu Pilot: ${k.total_users} / ${k.max_pilot_users || 100} người`;

    // Funnel
    $("funnel-list").innerHTML = data.funnel
      .map(
        (f) => `
      <div>
        <div class="mb-1 flex items-center justify-between text-xs">
          <span class="font-semibold text-slate-700">${escapeHtml(f.stage)}</span>
          <span class="font-bold text-slate-900">${f.count} người (${f.pct}%)</span>
        </div>
        <div class="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div class="h-full rounded-full bg-sky-600 transition-all duration-500" style="width: ${Math.max(3, f.pct)}%"></div>
        </div>
      </div>`
      )
      .join("");

    // Risk distribution
    const rd = data.risk_distribution;
    const totalPred = Math.max(1, Object.values(rd).reduce((a, b) => a + b, 0));
    const riskColors = {
      "THẤP": "bg-emerald-500",
      "TRUNG BÌNH": "bg-amber-500",
      "CAO": "bg-orange-500",
      "RẤT CAO": "bg-rose-600",
    };
    $("risk-dist-list").innerHTML = Object.entries(rd)
      .map(([lvl, cnt]) => {
        const pct = Math.round((cnt * 1000) / totalPred) / 10;
        return `
        <div>
          <div class="mb-1 flex justify-between text-xs">
            <span class="font-semibold text-slate-700">${escapeHtml(lvl)}</span>
            <span class="font-bold text-slate-900">${cnt} lượt (${pct}%)</span>
          </div>
          <div class="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div class="h-full rounded-full ${riskColors[lvl] || "bg-sky-500"}" style="width: ${Math.max(2, pct)}%"></div>
          </div>
        </div>`;
      })
      .join("");

    const s = data.system_info;
    $("system-info-box").innerHTML = `
      <div class="flex justify-between border-b border-slate-100 pb-1.5"><span>Phiên bản Điều khoản:</span><strong class="text-slate-900">${escapeHtml(s.current_terms_version)}</strong></div>
      <div class="flex justify-between border-b border-slate-100 pb-1.5"><span>Mô hình ML:</span><strong class="text-slate-900">${escapeHtml(s.ml_model)} (ngưỡng ${s.ml_threshold})</strong></div>
      <div class="flex justify-between border-b border-slate-100 pb-1.5"><span>Mô hình Chatbot Groq:</span><strong class="text-slate-900">${escapeHtml(s.groq_model)}</strong></div>
      <div class="flex justify-between"><span>Trạng thái Groq API Key:</span><strong class="${s.groq_configured ? "text-emerald-700" : "text-rose-700"}">${s.groq_configured ? "Đã cấu hình hợp lệ" : "Chưa cấu hình"}</strong></div>
    `;
  }

  // ── 2. Load 24h Deletion Requests ──────────────────────────────────────────
  async function loadDeletions() {
    const data = await apiFetch("/api/admin/deletion-requests");
    const tbody = $("deletion-table-body");

    if (!data.requests.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-slate-400">Hiện không có yêu cầu xóa tài khoản nào trong bảng account_deletion_requests.</td></tr>`;
    } else {
      tbody.innerHTML = data.requests
        .map((r) => {
          let countdownBadge = "—";
          if (r.status === "pending") {
            countdownBadge = r.is_overdue
              ? `<span class="rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white">⚠️ Quá hạn 24h (${Math.abs(r.hours_remaining)}h)</span>`
              : `<span class="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-900">⏳ Còn ${r.hours_remaining} giờ</span>`;
          }
          const statusBadge =
            r.status === "pending"
              ? `<span class="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-800">Chờ duyệt</span>`
              : `<span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">${escapeHtml(r.status)}</span>`;

          return `
          <tr class="hover:bg-slate-50">
            <td class="px-4 py-3 font-bold text-slate-700">#${r.id}</td>
            <td class="px-4 py-3">
              <div class="font-bold text-slate-900">${escapeHtml(r.username)}</div>
              <div class="text-[11px] text-slate-500">${escapeHtml(r.email || "Không có email")}</div>
            </td>
            <td class="px-4 py-3 max-w-xs">
              <div class="rounded-lg border border-rose-100 bg-rose-50/60 p-2 text-slate-800 font-medium">${escapeHtml(r.reason)}</div>
            </td>
            <td class="px-4 py-3 text-slate-600">${r.prediction_count} đánh giá • ${r.chat_count} chat</td>
            <td class="px-4 py-3 text-[11px] text-slate-500">
              <div>Gửi: ${fmtDate(r.requested_at)}</div>
              <div>Hạn: <strong class="text-slate-700">${fmtDate(r.scheduled_delete_at)}</strong></div>
            </td>
            <td class="px-4 py-3">${countdownBadge}</td>
            <td class="px-4 py-3">${statusBadge}</td>
            <td class="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
              ${
                r.status === "pending"
                  ? `<button onclick="window.hgApproveDelete(${r.id}, '${escapeHtml(r.username)}')" class="rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-rose-700">✓ Duyệt & Xóa ngay</button>
                     <button onclick="window.hgRejectDelete(${r.id}, '${escapeHtml(r.username)}')" class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">✕ Tạm giữ</button>`
                  : `<span class="text-[11px] text-slate-400">Đã xử lý</span>`
              }
            </td>
          </tr>`;
        })
        .join("");
    }

    const auditEl = $("deletion-audit-list");
    if (!data.audit_history.length) {
      auditEl.innerHTML = `<p class="text-xs text-slate-400">Chưa có bản ghi nào trong deletion_requests.json.</p>`;
    } else {
      auditEl.innerHTML = data.audit_history
        .map(
          (a) => `
        <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs">
          <div>
            <span class="font-bold text-slate-900">${escapeHtml(a.username)}</span>
            <span class="mx-1.5 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-700">${escapeHtml(a.action)}</span>
            <span class="text-slate-600">${escapeHtml(a.reason || "")}</span>
          </div>
          <span class="text-[11px] text-slate-400">${fmtDate(a.timestamp)}</span>
        </div>`
        )
        .join("");
    }
  }

  window.hgApproveDelete = async (reqId, username) => {
    if (!confirm(`Xác nhận DUYỆT & XÓA VĨNH VIỄN toàn bộ dữ liệu MySQL và file log của '${username}'?`)) return;
    try {
      const res = await apiFetch(`/api/admin/deletion-requests/${reqId}/approve`, {
        method: "POST",
        body: JSON.stringify({ note: "Admin duyệt xóa trực tiếp" }),
      });
      showToast(res.message);
      await loadDeletions();
      await loadOverview();
    } catch (e) {
      showToast(e.message, true);
    }
  };

  window.hgRejectDelete = async (reqId, username) => {
    const note = prompt(`Nhập lý do tạm giữ / từ chối yêu cầu xóa của '${username}':`, "Cần đối chiếu thêm thông tin");
    if (note === null) return;
    try {
      const res = await apiFetch(`/api/admin/deletion-requests/${reqId}/reject`, {
        method: "POST",
        body: JSON.stringify({ note }),
      });
      showToast(res.message);
      await loadDeletions();
      await loadOverview();
    } catch (e) {
      showToast(e.message, true);
    }
  };

  // ── 3. Load Users & Legal Consent Audit ────────────────────────────────────
  async function loadUsers() {
    const q = $("user-search-input").value.trim();
    const data = await apiFetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
    const tbody = $("users-table-body");

    if (!data.users.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400">Không tìm thấy người dùng nào.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.users
      .map((u) => {
        const consentOk = u.terms_version === data.current_terms_version && u.age_confirmed;
        const consentBadge = consentOk
          ? `<span class="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-700">✓ ${escapeHtml(u.terms_version)} (≥18t)</span>`
          : `<span class="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Chưa đồng ý (${escapeHtml(u.terms_version || "cũ")})</span>`;

        const p = u.profile || {};
        const sexStr = p.sex === 1 ? "Nam" : p.sex === 0 ? "Nữ" : "—";
        const profStr = p.age ? `${p.age}t • ${sexStr} • HA:${p.blood_pressure ?? "—"} • Chol:${p.cholesterol ?? "—"}` : "Chưa cập nhật";

        return `
        <tr class="hover:bg-slate-50">
          <td class="px-4 py-3 font-bold text-slate-700">#${u.id}</td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-slate-900">${escapeHtml(u.username)}</span>
              ${u.pending_deletion ? `<span class="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">Chờ xóa 24h</span>` : ""}
            </div>
            <div class="text-[11px] text-slate-500">${escapeHtml(u.email || "—")} ${u.phone ? "• " + escapeHtml(u.phone) : ""}</div>
          </td>
          <td class="px-4 py-3">
            <span class="rounded-full px-2 py-0.5 text-[11px] font-bold ${u.role === "admin" ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-700"}">${escapeHtml(u.role)}</span>
          </td>
          <td class="px-4 py-3">
            <div>${consentBadge}</div>
            <div class="mt-0.5 text-[10px] text-slate-400">Lúc: ${fmtDate(u.accepted_terms_at)}</div>
          </td>
          <td class="px-4 py-3 text-slate-600">${escapeHtml(profStr)}</td>
          <td class="px-4 py-3 font-semibold text-slate-700">${u.prediction_count} đánh giá • ${u.chat_count} chat</td>
          <td class="px-4 py-3 text-right space-x-1 whitespace-nowrap">
            <button onclick="window.hgInspectUser(${u.id})" class="rounded-lg bg-sky-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-sky-700">🔍 Chi tiết 360°</button>
            <button onclick="window.hgResetChat(${u.id}, '${escapeHtml(u.username)}')" class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">↺ Reset Chat</button>
            <button onclick="window.hgDeleteUser(${u.id}, '${escapeHtml(u.username)}')" class="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100">Xóa</button>
          </td>
        </tr>`;
      })
      .join("");
  }

  window.hgInspectUser = async (userId) => {
    try {
      const d = await apiFetch(`/api/admin/users/${userId}/detail`);
      const u = d.user;
      $("detail-title").textContent = `Chi tiết 360° Người dùng: ${u.username} (#${u.id})`;
      $("detail-subtitle").textContent = `Vai trò: ${u.role} • Điều khoản: ${u.terms_version || "chưa xác nhận"} (${fmtDate(u.accepted_terms_at)}) • Tạo lúc: ${fmtDate(u.created_at)}`;

      const predsHtml = d.predictions.length
        ? d.predictions
            .map(
              (p) => `
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div class="flex justify-between font-bold text-slate-900">
              <span>#${p.id} — ${escapeHtml(p.name_prediction || "Không tên")}</span>
              <span>Mức: ${escapeHtml(p.risk_level)} (${(Number(p.probability || 0) * 100).toFixed(1)}%) • Điểm LS: ${Number(p.clinical_score || 0).toFixed(2)}</span>
            </div>
            <div class="text-[11px] text-slate-500 mt-0.5">${fmtDate(p.timestamp)}</div>
            <pre class="mt-2 overflow-x-auto rounded bg-slate-900 p-2 text-[11px] text-emerald-300">${escapeHtml(JSON.stringify(p.inputs, null, 2))}</pre>
          </div>`
            )
            .join("")
        : `<p class="text-slate-400">Chưa có lịch sử đánh giá lưu trong MySQL.</p>`;

      const chatsHtml = d.chats.length
        ? d.chats
            .map(
              (c) => `
          <div class="rounded-xl border ${c.role === "user" ? "border-sky-200 bg-sky-50/60" : "border-slate-200 bg-white"} p-2.5">
            <div class="flex justify-between text-[11px] font-bold ${c.role === "user" ? "text-sky-800" : "text-slate-700"}">
              <span>${c.role === "user" ? "👤 Người dùng" : "🤖 Trợ lý AI"}</span>
              <span class="text-slate-400">${fmtDate(c.timestamp)}</span>
            </div>
            <div class="mt-1 whitespace-pre-wrap text-slate-800">${escapeHtml(c.content)}</div>
          </div>`
            )
            .join("")
        : `<p class="text-slate-400">Chưa có lịch sử trò chuyện Chatbot.</p>`;

      $("detail-body").innerHTML = `
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="rounded-xl border border-slate-200 p-4">
            <h4 class="font-bold text-slate-900 mb-2">1. Hồ sơ sức khỏe (MySQL user_information)</h4>
            <pre class="overflow-x-auto rounded bg-slate-900 p-3 text-[11px] text-sky-300">${escapeHtml(JSON.stringify(d.profile, null, 2))}</pre>
          </div>
          <div class="rounded-xl border border-slate-200 p-4">
            <h4 class="font-bold text-slate-900 mb-2">2. File JSON Vòng đời User (logs/logs_prediction_users/users/${escapeHtml(u.username)}.json)</h4>
            <pre class="max-h-48 overflow-auto rounded bg-slate-900 p-3 text-[11px] text-amber-300">${escapeHtml(JSON.stringify(d.json_logs.user_lifecycle, null, 2))}</pre>
          </div>
        </div>

        <div>
          <h4 class="font-bold text-slate-900 mb-2">3. Lịch sử Đánh giá trong MySQL (${d.predictions.length})</h4>
          <div class="space-y-2 max-h-64 overflow-y-auto">${predsHtml}</div>
        </div>

        <div>
          <h4 class="font-bold text-slate-900 mb-2">4. Lịch sử Hội thoại Chatbot (${d.chats.length})</h4>
          <div class="space-y-2 max-h-64 overflow-y-auto">${chatsHtml}</div>
        </div>

        <div>
          <h4 class="font-bold text-slate-900 mb-2">5. File JSON Log Đánh giá (logs/logs_prediction_users/prediction_with_users/${escapeHtml(u.username)}.json)</h4>
          <pre class="max-h-64 overflow-auto rounded-xl bg-slate-900 p-3 text-[11px] text-emerald-300">${escapeHtml(JSON.stringify(d.json_logs.prediction_with_users, null, 2))}</pre>
        </div>
      `;

      $("user-detail-modal").classList.remove("hidden");
      $("user-detail-modal").classList.add("flex");
    } catch (e) {
      showToast(e.message, true);
    }
  };

  window.hgResetChat = async (userId, username) => {
    try {
      const res = await apiFetch(`/api/admin/users/${userId}/reset-chat-quota`, { method: "POST" });
      showToast(`${username}: ${res.message}`);
    } catch (e) {
      showToast(e.message, true);
    }
  };

  window.hgDeleteUser = async (userId, username) => {
    if (!confirm(`Xác nhận xóa vĩnh viễn tài khoản '${username}' cùng toàn bộ dữ liệu MySQL & file log cá nhân?`)) return;
    try {
      await apiFetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      showToast(`Đã xóa hoàn toàn tài khoản '${username}'.`);
      await loadUsers();
      await loadOverview();
    } catch (e) {
      showToast(e.message, true);
    }
  };

  // ── 4. Load Unified JSON Logs ──────────────────────────────────────────────
  async function loadLogs() {
    const q = $("log-search-input").value.trim();
    const data = await apiFetch(`/api/admin/logs?category=${encodeURIComponent(currentLogCategory)}&q=${encodeURIComponent(q)}`);
    $("log-count-label").textContent = `Hiển thị ${data.entries.length} / ${data.total} bản ghi (${data.category})`;

    if (!data.entries.length) {
      $("logs-container").innerHTML = `<p class="py-8 text-center text-xs text-slate-400">Chưa có bản ghi log nào trong mục này.</p>`;
      return;
    }

    $("logs-container").innerHTML = data.entries
      .map(
        (item) => `
      <details class="group rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs">
        <summary class="flex cursor-pointer flex-wrap items-center justify-between gap-2 font-semibold text-slate-800">
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">${escapeHtml(item._file || "")}</span>
            <span class="font-bold text-sky-700">${escapeHtml(item.username || "—")}</span>
            <span class="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-800">
              ${escapeHtml(item.event || item.action || item.reason || item.status || "")}
            </span>
          </div>
          <span class="text-[11px] text-slate-400">${fmtDate(item.timestamp)}</span>
        </summary>
        <pre class="mt-2.5 overflow-x-auto rounded-lg bg-slate-900 p-3 text-[11px] text-emerald-300">${escapeHtml(JSON.stringify(item, null, 2))}</pre>
      </details>`
      )
      .join("");
  }

  // ── 5. Load & Save Runtime Control ─────────────────────────────────────────
  async function loadControl() {
    const c = await apiFetch("/api/admin/control");
    $("ctrl-chatbot-disabled").checked = Boolean(c.chatbot_disabled);
    $("ctrl-registration-disabled").checked = Boolean(c.registration_disabled);
    $("ctrl-prediction-disabled").checked = Boolean(c.prediction_disabled);
    $("ctrl-auto-purge").checked = Boolean(c.auto_purge_24h_deletions);
    $("ctrl-max-pilot").value = c.max_pilot_users ?? 100;
    $("ctrl-hourly-chat").value = c.hourly_chat_limit ?? 10;
    $("ctrl-pilot-notice").value = c.pilot_notice || "";
    $("ctrl-updated-meta").textContent = c.updated_at
      ? `Cập nhật lần cuối: ${fmtDate(c.updated_at)} bởi ${c.updated_by}`
      : "Đang dùng cấu hình mặc định.";
  }

  async function saveControl() {
    const payload = {
      chatbot_disabled: $("ctrl-chatbot-disabled").checked,
      registration_disabled: $("ctrl-registration-disabled").checked,
      prediction_disabled: $("ctrl-prediction-disabled").checked,
      auto_purge_24h_deletions: $("ctrl-auto-purge").checked,
      max_pilot_users: parseInt($("ctrl-max-pilot").value || "100", 10),
      hourly_chat_limit: parseInt($("ctrl-hourly-chat").value || "10", 10),
      pilot_notice: $("ctrl-pilot-notice").value.trim(),
    };
    const res = await apiFetch("/api/admin/control", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    showToast("Đã lưu và áp dụng cấu hình Kill Switch & Giới hạn Pilot ngay lập tức!");
    await loadControl();
    await loadOverview();
    return res;
  }

  // ── Event Listeners ────────────────────────────────────────────────────────
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".tab-btn").forEach((b) => {
        b.classList.remove("tab-active");
        b.classList.add("tab-idle");
      });
      btn.classList.add("tab-active");
      btn.classList.remove("tab-idle");

      const target = btn.getAttribute("data-tab");
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
      $(`tab-${target}`).classList.remove("hidden");

      try {
        if (target === "overview") await loadOverview();
        if (target === "deletions") await loadDeletions();
        if (target === "users") await loadUsers();
        if (target === "logs") await loadLogs();
        if (target === "control") await loadControl();
      } catch (e) {
        showToast(e.message, true);
      }
    });
  });

  document.querySelectorAll(".logcat-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".logcat-btn").forEach((b) => {
        b.className = "logcat-btn rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200";
      });
      btn.className = "logcat-btn rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white";
      currentLogCategory = btn.getAttribute("data-logcat");
      await loadLogs();
    });
  });

  $("btn-refresh-all").addEventListener("click", async () => {
    try {
      await loadOverview();
      await loadDeletions();
      showToast("Đã làm mới dữ liệu toàn hệ thống.");
    } catch (e) {
      showToast(e.message, true);
    }
  });

  $("btn-auto-purge").addEventListener("click", async () => {
    try {
      const res = await apiFetch("/api/admin/deletion-requests/auto-purge", { method: "POST" });
      showToast(res.message);
      await loadDeletions();
      await loadOverview();
    } catch (e) {
      showToast(e.message, true);
    }
  });

  $("btn-search-users").addEventListener("click", () => loadUsers().catch((e) => showToast(e.message, true)));
  $("user-search-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadUsers().catch((err) => showToast(err.message, true));
  });

  $("btn-filter-logs").addEventListener("click", () => loadLogs().catch((e) => showToast(e.message, true)));
  $("log-search-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadLogs().catch((err) => showToast(err.message, true));
  });

  $("btn-save-control").addEventListener("click", () => saveControl().catch((e) => showToast(e.message, true)));

  $("btn-close-detail").addEventListener("click", () => {
    $("user-detail-modal").classList.add("hidden");
    $("user-detail-modal").classList.remove("flex");
  });

  $("btn-export-csv").addEventListener("click", async () => {
    try {
      const token = getToken();
      const res = await fetch("/api/admin/export/anonymized?fmt=csv", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Không thể xuất CSV.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "heartguard_pilot_anonymized.csv";
      a.click();
      URL.revokeObjectURL(url);
      showToast("Đã tải xuống file CSV nghiên cứu ẩn danh!");
    } catch (e) {
      showToast(e.message, true);
    }
  });

  $("btn-local-unlock").addEventListener("click", async () => {
    try {
      const res = await fetch("/api/admin/local-unlock", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Không thể mở khóa local.");
      setSession(data.access_token, data.username);
      $("login-modal").classList.add("hidden");
      $("login-modal").classList.remove("flex");
      await loadOverview();
      showToast(`Xin chào Admin ${data.username}!`);
    } catch (e) {
      const errEl = $("login-error");
      errEl.textContent = e.message;
      errEl.classList.remove("hidden");
    }
  });

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: $("login-username").value.trim(),
          password: $("login-password").value,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Đăng nhập thất bại.");
      setSession(data.access_token, data.username);
      $("login-modal").classList.add("hidden");
      $("login-modal").classList.remove("flex");
      await loadOverview();
      showToast(`Đăng nhập thành công (${data.username})!`);
    } catch (err) {
      const errEl = $("login-error");
      errEl.textContent = err.message;
      errEl.classList.remove("hidden");
    }
  });

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  (async () => {
    const savedUser = localStorage.getItem(USER_KEY);
    if (savedUser) $("admin-badge").textContent = `👤 Admin: ${savedUser}`;
    try {
      if (!getToken()) {
        // Tự động mở khóa nhanh nếu đang ở trực tiếp trên 127.0.0.1
        const unlock = await fetch("/api/admin/local-unlock", { method: "POST" });
        if (unlock.ok) {
          const d = await unlock.json();
          setSession(d.access_token, d.username);
        }
      }
      await loadOverview();
    } catch {
      $("login-modal").classList.remove("hidden");
      $("login-modal").classList.add("flex");
    }
  })();
})();
