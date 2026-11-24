# DEV-MATCH · Pembayaran Midtrans Sandbox

Room Chat menyediakan alur proposal, pembayaran DP dan pelunasan, persetujuan hasil, serta escrow, dispute, refund, dan payout simulasi.

## Jalankan lokal

Gunakan Node.js 24 atau lebih baru. Aplikasi memakai modul bawaan Node.js dan SQLite.

```powershell
Copy-Item .env.example .env
npm.cmd start
```

Isi `MIDTRANS_SERVER_KEY` dan `MIDTRANS_CLIENT_KEY` dengan key dari dashboard Midtrans **Sandbox** sebelum memulai server. Jika dashboard menyediakan secret webhook terpisah, isi juga `MIDTRANS_SIGNATURE_SECRET`. File `.env` dan database di `.payment-data/` diabaikan Git.

Buka halaman **Create account** di DEV-MATCH dan buat masing-masing akun Developer dan Client. Untuk menguji dispute, buat satu akun terpisah, lalu tetapkan sebagai Reviewer dari terminal server. Tetapkan peserta untuk room yang akan dipakai:

```powershell
npm.cmd run payment-room -- reviewer reviewer@example.test
npm.cmd run payment-room -- assign jessica-sitorus dev@example.test client@example.test reviewer@example.test
```

Pakai email akun yang sudah terdaftar. Argumen email Reviewer opsional. ID room tampil di panel **Pembayaran** jika akun yang login belum terdaftar sebagai peserta. Data transaksi demo dari versi sebelumnya tetap tersimpan di database lokal dan terpisah dari room yang memakai akun.

Buka [Room Chat](http://127.0.0.1:3000/devmatch-chat.html?contact=jessica) dan klik **Pembayaran**. Login dari profil browser berbeda untuk membuka room sebagai Developer, Client, dan Reviewer. Peran pembayaran mengikuti sesi akun dan keanggotaan room. Proposal dan review bisa dicoba tanpa key. Checkout memerlukan key Sandbox.

## Uji alur

1. Sebagai **Developer**, kirim proposal beserta total harga, DP 25% atau 50%, durasi, scope, deliverables, dan ketentuan revisi.
2. Buka room yang sama dari sesi **Client**, terima proposal, klik **Bayar DP**, lalu jalankan transaksi uji di Snap Sandbox.
3. Setelah DP terverifikasi, **Developer** memverifikasi tujuan payout demo, mengirim progress, dan mengirim final delivery lewat tautan HTTPS.
4. Sebagai **Client**, bayar pelunasan, lalu setujui final delivery atau minta revisi. Persetujuan dengan dua pembayaran terverifikasi memulai payout simulasi. **Developer** menyelesaikan payout tersebut.
5. Untuk skenario dispute, ajukan dispute dari peran **Client** atau **Developer**. Pencairan dibekukan sampai **Reviewer dispute** mencatat keputusan simulasi. Selesaikan transaksi yang masih aktif sebelum melakukan review.

Backend mengunci nominal dari proposal yang diterima. DP dibulatkan ke atas ke Rupiah penuh, dan pelunasan dihitung dari total dikurangi DP. Total demo minimal Rp40.000 agar DP 25% mencapai Rp10.000, batas minimum beberapa metode bayar. Platform dan biaya payout simulasi masing-masing Rp0.

Untuk uji webhook, arahkan **Payment Notification URL** di dashboard Sandbox ke `https://<host-uji>/api/payments/midtrans/webhook` yang dapat dijangkau Midtrans. Pertahankan server demo pada jaringan lokal dan teruskan hanya rute webhook jika memakai penerusan HTTPS. **Perbarui status pembayaran** meminta backend menjalankan pengecekan Get Status saat webhook belum sampai. Bukti di Room Chat muncul setelah status terverifikasi.

Lihat [panduan Snap](https://docs.midtrans.com/docs/snap-snap-integration-guide) dan [dokumentasi webhook Midtrans](https://docs.midtrans.com/docs/https-notification-webhooks).

## Tes otomatis

```powershell
npm.cmd test
```

Tes menjalankan API dan SQLite lokal dengan respons Midtrans tiruan. Data ledger, review, refund, verifikasi tujuan payout, dan payout merupakan simulasi internal. Peserta pembayaran dikelola lewat terminal karena percakapan dan profil di prototipe masih disimpan lokal.
