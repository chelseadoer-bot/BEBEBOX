/** 사진 업로드 / 조회 / 삭제 (로컬 SQLite 백엔드) */

function getFamilyId() {
  const code = typeof getInviteCode === "function" ? getInviteCode() : null;
  return String(code || "BEBEBOX").trim().toUpperCase();
}

async function uploadPhotoToServer(file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("family_id", getFamilyId());
  const res = await fetch("/api/photos/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.detail || "upload_failed");
  }
  return res.json();
}

async function fetchPhotosFromServer() {
  const family = encodeURIComponent(getFamilyId());
  const res = await fetch(`/api/photos?family=${family}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.photos || [];
}

async function deletePhotoFromServer(id) {
  const family = encodeURIComponent(getFamilyId());
  const res = await fetch(`/api/photos/${encodeURIComponent(id)}?family=${family}`, { method: "DELETE" });
  return res.ok;
}

async function fetchStorageConfig() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) return { storage: "sqlite" };
    return res.json();
  } catch {
    return { storage: "sqlite" };
  }
}

function isServerPhotoId(id) {
  return String(id || "").startsWith("p");
}
