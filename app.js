let db = null;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[m]));
}

async function loadDB() {
  // Chống cache để khi Thầy cập nhật JSON, HS mở lại là thấy mới
  const url = `data/grades.json?v=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Không tải được dữ liệu");
  return await res.json();
}

function renderRecord(rec) {
  // Map đổi tên cột
  const LABEL_MAP = {
    "TX1": "Thường xuyên 1",
    "TX2": "Thường xuyên 2",
    "TX3": "Thường xuyên 3",
    "GKTN": "Giữa Kỳ Trắc Nghiệm",
    "GKTH": "Giữa Kỳ Thực Hành",
    "CKTN": "Cuối Kỳ Trắc Nghiệm",
    "CKTH": "Cuối Kỳ Thực Hành",
  };

  // Chuẩn hóa key để map (vd: "TX 1" -> "TX1", "gktn" -> "GKTN")
  const normKey = (k) => String(k ?? "").replace(/\s+/g, "").toUpperCase();

  // Nếu có map thì dùng, không thì giữ nguyên tên cột gốc
  const prettyKey = (k) => LABEL_MAP[normKey(k)] ?? String(k ?? "");

  // Header thông tin HS (HIỂN THỊ cả Email + Ngày sinh)
  const header = `
    <div>
      <div><b>Họ và tên:</b> ${escapeHtml(rec["Họ và tên"] ?? "")}</div>
      <div><b>Lớp:</b> ${escapeHtml(rec["Tên lớp"] ?? "")}</div>
      <div><b>MSHS:</b> ${escapeHtml(rec["MSHS"] ?? "")}</div>
      <div><b>Mã định danh:</b> ${escapeHtml(rec["Mã định danh"] ?? "")}</div>
      <div><b>Email:</b> ${escapeHtml(rec["Email"] ?? "")}</div>
      <div><b>Ngày sinh:</b> ${escapeHtml(rec["Ngày sinh"] ?? "")}</div>
    </div>
  `;

  // Các cột thông tin không đưa vào bảng điểm (nhưng KHÔNG loại Email/Ngày sinh nữa)
  const skip = new Set(["STT", "Tên lớp", "Mã định danh", "MSHS", "Họ và tên", "Email", "Ngày sinh"]);

  // Lấy các cột điểm (và các cột khác ngoài thông tin)
  let keys = Object.keys(rec).filter(k => !skip.has(k));

  // Ưu tiên thứ tự các cột quen thuộc
  const PRIORITY = ["TX1", "TX2", "TX3", "GKTN", "GKTH", "CKTN", "CKTH"];

  keys.sort((a, b) => {
    const na = normKey(a);
    const nb = normKey(b);
    const ia = PRIORITY.indexOf(na);
    const ib = PRIORITY.indexOf(nb);

    // Nếu 1 trong 2 nằm trong priority thì đưa lên trước theo thứ tự priority
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);

    // Còn lại sắp xếp theo tên cột (tiếng Việt)
    return String(a).localeCompare(String(b), "vi");
  });

  if (keys.length === 0) {
    return `${header}<p class="bad">Không có cột điểm để hiển thị.</p>`;
  }

  // Bảng ngang: 1 hàng tiêu đề + 1 hàng giá trị
  const thead = keys.map(k => `<th>${escapeHtml(prettyKey(k))}</th>`).join("");

  const tvals = keys.map(k => {
    const v = (rec[k] === null || rec[k] === undefined || rec[k] === "") ? "-" : rec[k];
    return `<td>${escapeHtml(v)}</td>`;
  }).join("");

  return `
  ${header}
  <div class="table-wrap">
    <table class="table">
      <thead><tr>${thead}</tr></thead>
      <tbody><tr>${tvals}</tr></tbody>
    </table>
  </div>
  `;
}

window.addEventListener("DOMContentLoaded", async () => {
  const meta = document.getElementById("meta");
  const result = document.getElementById("result");
  meta.textContent = "Đang tải dữ liệu...";

  try {
    db = await loadDB();
    meta.textContent = `Cập nhật lần cuối: ${db.last_updated || "(không rõ)"}`;
  } catch (e) {
    meta.innerHTML = `<span class="bad">Lỗi tải dữ liệu: ${escapeHtml(e.message)}</span>`;
    return;
  }

  document.getElementById("lookupForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    result.innerHTML = "";

    const code = document.getElementById("codeInput").value.trim();
    if (!code) {
      result.innerHTML = `<p class="bad">Vui lòng nhập mã định danh.</p>`;
      return;
    }
    if (!db?.records) {
      result.innerHTML = `<p class="bad">Chưa có dữ liệu.</p>`;
      return;
    }

    const rec = db.records[code];
    if (!rec) {
      result.innerHTML = `<p class="bad">Không tìm thấy mã định danh này.</p>`;
      return;
    }

    result.innerHTML = `<p class="ok">Tìm thấy dữ liệu.</p>` + renderRecord(rec);
  });
});
