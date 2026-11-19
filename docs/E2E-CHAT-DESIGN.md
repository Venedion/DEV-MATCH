# Rancangan: Chat End-to-End Encrypted (E2EE)

Status: **rancangan, belum dikerjakan**. Dibuat 2026-11-20 setelah audit backend (item #11).

## 1. Masalah sekarang

Pesan dienkripsi AES-256-GCM oleh Edge Function `chat-api` memakai kunci di secret
`CHAT_ENCRYPTION_KEYS`. Artinya:

- Server (dan siapa pun yang memegang secret atau service role) bisa membaca semua pesan dan lampiran.
- Kalau secret bocor, semua riwayat chat ikut bocor.

Ini enkripsi *at rest*, bukan end-to-end.

## 2. Tujuan dan batasan

**Tujuan**
1. Isi pesan dan lampiran hanya bisa dibaca oleh dua peserta percakapan.
2. Server tetap bisa: menyimpan pesan, mengecek siapa peserta, rate limit, notifikasi
   ("Kamu punya pesan baru" tanpa isi), menghitung jumlah pesan (dipakai syarat review).
3. Satu akun bisa membuka chat di beberapa perangkat (HP dan laptop).
4. Hanya memakai WebCrypto bawaan browser, tanpa library kripto tambahan.

**Bukan tujuan (untuk versi pertama)**
- Forward secrecy per pesan seperti Signal (double ratchet). Terlalu rumit untuk tahap ini;
  bisa ditambah nanti.
- Melindungi dari perangkat user yang sudah dibobol (malware di browser).
- Melindungi metadata: server tetap tahu siapa chat dengan siapa dan kapan.

**Ancaman yang ditangani**
- Database atau backup bocor → isi pesan tetap aman.
- Secret Edge Function bocor → isi pesan baru tetap aman.
- Admin/pegawai yang membuka database → tidak bisa membaca chat.

**Ancaman yang hanya dikurangi**
- Server jahat menukar kunci publik (man-in-the-middle). Dikurangi dengan peringatan
  "kunci kontak berubah" dan kode keamanan yang bisa dicocokkan (lihat bagian 5.5).

## 3. Gambaran umum

```
Akun A                         Server (Supabase)                     Akun B
------                         -----------------                     ------
kunci akun A (privat)          menyimpan:                            kunci akun B (privat)
  disimpan di browser            - kunci publik A, B                   disimpan di browser
  + cadangan terenkripsi          - cadangan kunci privat (terenkripsi
    di server                       dengan kode pemulihan, server tidak
                                    bisa membuka)
                                  - kunci percakapan, dibungkus
                                    untuk A dan untuk B
                                  - pesan terenkripsi

Kirim pesan: A mengenkripsi dengan kunci percakapan → server menyimpan ciphertext → B mendekripsi.
```

Tiga lapis kunci:

| Kunci | Jenis | Dibuat oleh | Disimpan |
| --- | --- | --- | --- |
| **Kunci akun** | ECDH P-256 (pasangan publik/privat) | browser user, sekali per akun | Publik: server. Privat: IndexedDB (non-extractable) + cadangan terenkripsi di server. |
| **Kunci cadangan** | AES-256-GCM, diturunkan dari kode pemulihan | browser | Tidak disimpan di mana pun; dihitung ulang dari kode pemulihan. |
| **Kunci percakapan** | AES-256-GCM | browser yang memulai percakapan | Server, dibungkus (wrapped) dengan kunci akun masing-masing peserta. |
| **Kunci file** | AES-256-GCM, satu per lampiran | browser pengirim | Di dalam isi pesan yang terenkripsi. |

Kunci akun dibuat **per user**, bukan per workspace: satu orang dengan workspace client
dan dev tetap satu identitas kriptografis (sama seperti `profiles.id`).

## 4. Perubahan database

Migrasi baru (contoh nama `2026112x_e2e_chat_keys.sql`):

```sql
-- Kunci publik dan cadangan kunci privat per akun.
create table public.chat_identity_keys (
  user_id uuid not null references auth.users(id) on delete cascade,
  key_version integer not null check (key_version > 0),
  public_key jsonb not null,               -- JWK ECDH P-256 (publik saja)
  encrypted_private_key text not null,     -- base64url, AES-GCM dengan kunci cadangan
  backup_nonce text not null,
  backup_kdf jsonb not null,               -- {"name":"PBKDF2","hash":"SHA-256","iterations":600000,"salt":"..."}
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, key_version)
);
-- Kunci publik boleh dibaca peserta percakapan; cadangan hanya oleh pemiliknya
-- (dibagi jadi view publik + RPC untuk cadangan).

-- Kunci percakapan yang dibungkus untuk tiap peserta.
create table public.conversation_keys (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  key_version integer not null check (key_version > 0),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  recipient_key_version integer not null,  -- versi kunci akun penerima yang dipakai
  sender_id uuid not null references auth.users(id),
  ephemeral_public_key jsonb not null,     -- untuk ECDH
  wrapped_key text not null,               -- kunci percakapan, AES-GCM
  wrap_nonce text not null,
  created_at timestamptz not null default now(),
  primary key (conversation_id, key_version, recipient_id)
);

alter table public.messages
  add column scheme text not null default 'server-v1'
    check (scheme in ('server-v1', 'e2e-v2')),
  add column conversation_key_version integer,
  add column client_message_id uuid unique;
```

RLS:
- `chat_identity_keys`: user hanya bisa insert/update miliknya sendiri; kolom
  `encrypted_private_key` hanya bisa dibaca pemilik (lewat RPC `get_my_chat_key_backup()`).
  Kunci publik dibaca lewat RPC `get_chat_public_keys(conversation_id)` yang hanya
  mengembalikan kunci peserta percakapan itu.
- `conversation_keys`: peserta percakapan boleh insert untuk percakapan itu;
  hanya `recipient_id = auth.uid()` yang boleh membaca barisnya.
- `messages`: pesan `e2e-v2` di-insert langsung oleh client lewat RLS
  (pengirim harus peserta dan cocok dengan workspace), dengan rate limit trigger yang
  sudah ada. `chat-api` tidak lagi perlu memegang kunci untuk pesan baru.

## 5. Alur

### 5.1 Pertama kali membuka chat (setup kunci)
1. Browser membuat pasangan kunci ECDH P-256 (`extractable: true` sementara).
2. Browser membuat **kode pemulihan** acak 128-bit, ditampilkan sekali dalam format
   mudah dicatat (mis. `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`). User wajib mencentang
   "Saya sudah menyimpan kode ini".
3. Kunci cadangan = PBKDF2-SHA256 (600.000 iterasi, salt acak) dari kode pemulihan.
4. Kunci privat diekspor (JWK), dienkripsi dengan kunci cadangan, lalu dikirim ke
   `chat_identity_keys` bersama kunci publik.
5. Kunci privat di-import ulang sebagai **non-extractable** dan disimpan di IndexedDB.
   Salinan yang bisa diekspor dibuang dari memori.

Kode pemulihan acak dipilih daripada password buatan user karena password pendek bisa
ditebak secara offline oleh siapa pun yang memegang database.

### 5.2 Login di perangkat baru
1. Browser tidak menemukan kunci di IndexedDB, tetapi server punya cadangan.
2. User memasukkan kode pemulihan → browser menurunkan kunci cadangan → membuka
   kunci privat → menyimpannya non-extractable di IndexedDB.
3. Kode salah → pesan error, tidak ada yang dikirim ke server (verifikasi lewat
   AES-GCM yang gagal didekripsi).

Opsi lanjutan (fase berikutnya): menyetujui perangkat baru dari perangkat lama lewat
QR, tanpa mengetik kode.

### 5.3 Memulai percakapan
1. `chat-api` tetap membuat baris `conversations` (pengecekan workspace dan rate limit
   tetap di server).
2. Browser pemulai membuat kunci percakapan acak (AES-256-GCM).
3. Untuk setiap peserta (termasuk dirinya sendiri): buat kunci ECDH sementara,
   ECDH dengan kunci publik peserta → HKDF-SHA256 (info: `devmatch-conv-key|<conversation_id>|<key_version>|<recipient_id>`)
   → kunci pembungkus → bungkus kunci percakapan. Simpan ke `conversation_keys`.
4. Kalau lawan bicara belum pernah setup kunci, percakapan berstatus
   "menunggu kunci": pesan pertama ditahan di perangkat pengirim (atau dikirim lewat
   skema lama dengan label jelas, keputusan di bagian 9).

### 5.4 Kirim dan terima pesan
Format isi (sebelum enkripsi), sama dengan sekarang supaya UI tidak berubah:
```json
{"version": 2, "text": "...", "attachments": [{"id","name","type","size","path","file_key","nonce"}]}
```
- Enkripsi: AES-256-GCM, nonce 96-bit acak.
- AAD: `conversation_id|sender_id|conversation_key_version|client_message_id`, supaya
  ciphertext tidak bisa dipindah ke percakapan atau pengirim lain.
- Insert langsung ke `messages` (`scheme = 'e2e-v2'`). Realtime sudah mengirim baris
  baru ke peserta; penerima mendekripsi di browser.
- Teks ditampilkan dengan escape HTML seperti sekarang (`escapeHtml`). Server tidak bisa
  lagi menyaring isi, jadi escape di client adalah satu-satunya lapisan, dan wajib.

### 5.5 Verifikasi kunci (anti man-in-the-middle)
- Browser menyimpan sidik jari (SHA-256) kunci publik kontak saat pertama kali melihatnya.
- Kalau kunci kontak berubah, tampilkan banner: "Kunci keamanan [nama] berubah.
  Ini normal kalau dia ganti perangkat atau reset kode pemulihan."
- Panel detail chat menampilkan **kode keamanan** 60 digit (gabungan sidik jari kedua
  pihak) yang bisa dicocokkan lewat telepon atau tatap muka.

### 5.6 Lampiran
1. Browser membuat kunci file acak, mengenkripsi file, upload langsung ke bucket
   `chat-attachments` di path `<conversation_id>/<sender_id>/<id>.bin`.
2. Policy storage baru: peserta boleh insert ke folder percakapannya sendiri, dengan
   batas ukuran dan rate limit upload yang sudah ada.
3. Kunci file dan nonce disimpan di dalam isi pesan terenkripsi.
4. Pengecekan tanda tangan file (yang sekarang di server) pindah ke browser penerima
   sebelum menampilkan pratinjau; file selalu diunduh sebagai attachment, tidak dibuka inline.

### 5.7 Reset kunci (kode pemulihan hilang)
- User membuat kunci akun baru (`key_version + 1`), kunci lama ditandai `revoked_at`.
- **Pesan lama yang hanya bisa dibuka dengan kunci lama tidak bisa dibaca lagi.**
  Ini harus dijelaskan jelas di UI sebelum user mengonfirmasi.
- Saat lawan bicara membuka percakapan, browser-nya membungkus ulang kunci percakapan
  untuk kunci baru (dengan banner "kunci berubah" dari 5.5), sehingga percakapan bisa
  dilanjutkan.

## 6. Pesan lama (`server-v1`)

Pesan yang sudah ada dienkripsi dengan kunci server. Rencana:

1. **Fase awal**: pesan lama tetap dibaca lewat `chat-api` seperti sekarang dan diberi
   label "Pesan sebelum enkripsi end-to-end". Pesan baru `e2e-v2`.
2. **Fase migrasi (opsional)**: saat kedua peserta sudah punya kunci, browser salah satu
   peserta mengambil pesan lama yang sudah didekripsi dari `chat-api`, mengenkripsi ulang
   dengan kunci percakapan, dan mengganti barisnya (RPC khusus yang hanya mengizinkan
   peserta dan hanya mengubah `server-v1` → `e2e-v2`).
3. Setelah semua pesan aktif dimigrasikan, hapus `CHAT_ENCRYPTION_KEYS` dan jalur
   dekripsi di `chat-api`. Pesan lama yang belum dimigrasikan saat itu tidak bisa dibuka
   lagi, jadi beri tenggat yang jelas.

Catatan: server sudah pernah bisa membaca pesan lama, jadi migrasi ini melindungi dari
kebocoran di masa depan, bukan dari yang sudah lewat.

## 7. Dampak ke fitur lain

| Fitur | Dampak |
| --- | --- |
| Notifikasi pesan | Tetap jalan; memang tidak berisi teks pesan. |
| Pratinjau pesan terakhir di inbox | Didekripsi di browser, bukan di `chat-api`. Inbox perlu memuat kunci percakapan untuk tiap baris (cache di IndexedDB). |
| Pencarian chat | Hanya di pesan yang sudah dimuat di browser. Tidak ada pencarian server. |
| Syarat review (≥ 3 pesan per pihak) | Tetap jalan; server menghitung baris, bukan isi. |
| Laporan penyalahgunaan | Perlu fitur "Laporkan" yang mengirim isi pesan yang dipilih user secara sukarela. Admin tidak bisa membaca chat tanpa itu. |
| Penyaringan isi oleh server | Hilang. Escape HTML di client wajib dan harus dites. |
| Dukungan pelanggan | Admin tidak bisa membantu memulihkan chat kalau kode pemulihan hilang. |

## 8. Rencana pengerjaan

| Fase | Isi | Perkiraan |
| --- | --- | --- |
| 0. Persiapan tes | Tes browser otomatis (Playwright) untuk alur chat yang ada sekarang, supaya perubahan bisa dicek. Saat ini belum ada tes browser sama sekali. | 3–4 hari |
| 1. Kunci akun | Tabel `chat_identity_keys`, RPC, layar setup kode pemulihan, buka di perangkat baru, penyimpanan IndexedDB. | 4–5 hari |
| 2. Pesan E2E | `conversation_keys`, pembungkusan kunci, kirim/terima `e2e-v2` di balik feature flag, label pesan lama, verifikasi kunci (5.5). | 5–7 hari |
| 3. Lampiran E2E | Upload langsung terenkripsi, policy storage, unduh dan dekripsi. | 3 hari |
| 4. Reset kunci | Alur reset, bungkus ulang oleh lawan bicara, peringatan UI. | 2–3 hari |
| 5. Migrasi pesan lama | RPC enkripsi ulang, tenggat, pensiunkan kunci server. | 3–4 hari |

Total kira-kira **4–5 minggu kerja untuk satu developer**, ditambah waktu uji coba
dengan user sungguhan sebelum feature flag dinyalakan untuk semua.

## 9. Keputusan yang perlu diambil tim

1. **Lawan bicara belum setup kunci**: tahan pesan sampai dia setup (lebih aman,
   tapi chat pertama bisa tertunda), atau kirim lewat skema lama dengan label
   "belum end-to-end" (lebih lancar)?
2. **Kode pemulihan wajib** saat pertama membuka chat, atau boleh dilewati (dengan
   risiko kehilangan chat saat ganti perangkat)?
3. **Tenggat migrasi pesan lama** sebelum kunci server dihapus (usulan: 90 hari).
4. **Fitur "Laporkan pesan"** perlu ada sebelum E2E diluncurkan, supaya moderasi masih mungkin?

## 10. Risiko

- **User kehilangan kode pemulihan** → chat lama hilang permanen. Ini konsekuensi
  langsung dari E2E dan harus dijelaskan sejak awal.
- **XSS di halaman chat** akan membuka semua pesan, karena kunci ada di browser.
  CSP ketat (`script-src 'self'`, sudah diterapkan di audit) dan escape HTML wajib dijaga.
- **Bug kriptografi buatan sendiri**. Pakai hanya primitif standar WebCrypto
  (ECDH P-256, HKDF, AES-GCM, PBKDF2), jangan merancang algoritma sendiri, dan minta
  review pihak ketiga sebelum peluncuran.
- **Performa inbox**: mendekripsi pratinjau untuk 100 percakapan di browser; perlu
  cache kunci percakapan agar tidak membuka ulang setiap kali.
