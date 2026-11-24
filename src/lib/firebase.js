import { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile,
  GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, signOut as fbSignOut,
} from "firebase/auth";

// Konfigurasi web app dibuat otomatis saat deploy (public/fb.json). Kunci API Firebase memang publik.
let authP = null;
export function authInstance() {
  if (!authP) authP = (async () => {
    let cfg = null;
    for (const u of ["/fb.json", "/__/firebase/init.json"]) {
      try { const r = await fetch(u); if (r.ok) { const j = await r.json(); if (j.apiKey) { cfg = j; break; } } } catch { /* coba berikutnya */ }
    }
    if (!cfg) { authP = null; throw new Error("no_config"); }
    return getAuth(initializeApp(cfg));
  })();
  return authP;
}

export function useAuth() {
  const [st, setSt] = useState({ ready: false, user: null, error: null });
  useEffect(() => {
    let off = () => {}, dead = false;
    authInstance()
      .then((a) => { off = onAuthStateChanged(a, (u) => !dead && setSt({ ready: true, error: null, user: u ? { uid: u.uid, email: u.email, name: u.displayName || "" } : null })); })
      .catch(() => !dead && setSt({ ready: true, user: null, error: "config" }));
    return () => { dead = true; off(); };
  }, []);
  return st;
}

export async function getToken() {
  const a = await authInstance();
  return a.currentUser ? a.currentUser.getIdToken() : null;
}

export async function register(email, pw, name) {
  const a = await authInstance();
  const c = await createUserWithEmailAndPassword(a, email, pw);
  if (name) { try { await updateProfile(c.user, { displayName: name }); } catch { /* nama juga disimpan di profil */ } }
  return c.user;
}
export async function login(email, pw) { return (await signInWithEmailAndPassword(await authInstance(), email, pw)).user; }
export async function loginGoogle() { return (await signInWithPopup(await authInstance(), new GoogleAuthProvider())).user; }
export async function resetPassword(email) { return sendPasswordResetEmail(await authInstance(), email); }
export async function logout() { return fbSignOut(await authInstance()); }

// Pesan ramah dalam Bahasa Indonesia; tidak pernah menampilkan kode teknis.
export function authErr(e) {
  const c = e?.code || e?.message || "";
  if (/popup-closed|cancelled-popup/.test(c)) return "";
  if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return "Email atau kata sandi salah.";
  if (/email-already-in-use/.test(c)) return "Email ini sudah terdaftar. Coba masuk.";
  if (/weak-password/.test(c)) return "Kata sandi minimal 6 karakter.";
  if (/invalid-email/.test(c)) return "Format email belum benar.";
  if (/too-many-requests/.test(c)) return "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.";
  if (/network/.test(c)) return "Tidak ada koneksi internet.";
  if (/operation-not-allowed|configuration-not-found/.test(c)) return "Metode masuk ini belum diaktifkan di server.";
  if (/no_config/.test(c)) return "Layanan akun belum siap. Coba lagi sebentar lagi.";
  return "Belum berhasil. Coba lagi sebentar lagi.";
}
