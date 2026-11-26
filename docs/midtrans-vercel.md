# DEV-MATCH Midtrans Sandbox di Vercel

Frontend tetap memakai sesi Supabase yang sama dengan Room Chat. Proposal dari dialog **Propose project** menjadi sumber terms; saat Client menerima, terms dikunci dalam agreement dan pembayaran ditautkan ke agreement tersebut. Checkout memakai halaman Snap Sandbox dan status diverifikasi oleh backend. Refund, escrow, dan payout di DEV-MATCH adalah simulasi.

## Tutorial tes pelunasan

Pakai dua akun berbeda di chat proyek yang sama. Akun Developer mengirim progress dan video akhir. Akun Client yang menerima proposal melakukan pelunasan. [Buka listing Demo · Website Rasa Kota](https://devm4tch.vercel.app/devmatch-discover-project-detail.html?project=ede8ff29-a6ef-4602-adab-30fe9e738c88).

### Siapkan pelunasan

1. **Client** buka **Project payments** dan pastikan langkah **DP paid** sudah selesai.
2. **Developer** klik **Upload progress**. Unggah video MP4, MOV, atau WebM dengan ukuran maksimal 50 MB dan durasi maksimal 5 menit. Isi **Notes**, centang minimal satu **Scope points shown**, lalu klik **Submit progress**.
3. **Client** buka chat yang sama dan klik **Review progress**, lalu **Approve progress**.
4. **Developer** klik **Submit final video**. Isi **Notes** dan **Video URL (HTTPS)** yang bisa dibuka Client, lalu klik **Submit final video**.
5. **Client** buka kartu proposal dan klik **Pay remaining**. Jika tombolnya belum muncul, cek apakah **Progress review** dan **Final proof** sudah selesai di **Project payments**.

### Bayar dengan simulasi BCA Virtual Account

1. Di Snap Sandbox, pilih **Bank Transfer**, lalu **BCA**. Klik **Copy** di samping nomor virtual account pelunasan.
2. Tempel nomor tersebut ke kolom **Virtual Account Number** dan klik **Inquire**. Gunakan [Simulator BCA Virtual Account Midtrans](https://simulator.sandbox.midtrans.com/bca/va/index).
3. Cocokkan nominal dengan tombol **Pay remaining** di DEV-MATCH, lalu klik **Pay** di simulator. Gunakan simulator untuk menyelesaikan transaksi uji. [Panduan Midtrans Sandbox](https://docs.midtrans.com/docs/testing-payment-on-sandbox).
4. Kembali ke Snap di DEV-MATCH dan klik **Check status**. Buka **Project payments** dan pastikan langkah **Remaining payment** selesai atau kartu chat menampilkan **Remaining paid**.

Checkout baru berlaku 10 menit. Jika kedaluwarsa, klik **Retry remaining payment** dan gunakan nomor virtual account dari checkout baru. Langkah simulasi juga tersedia di **Panduan pembayaran demo** di atas panel Snap.

## Deploy

1. Terapkan migrasi proposal `202611240001_project_proposals.sql`, migrasi pembayaran lama `20261124120000_midtrans_sandbox_payments.sql` dan `20261125140000_payment_room_chat_context.sql`, serta `202611260001_proposal_agreement_payments.sql` ke proyek Supabase yang melayani frontend. Migrasi pembayaran agreement menghubungkan order dan status pembayaran ke agreement proposal, sementara tabel pembayaran proyek lama tetap dipertahankan.
2. Deploy fungsi `payment-api` dengan `supabase functions deploy payment-api --project-ref yxwktllqbmhustmhdaqi --no-verify-jwt`. Fungsi memvalidasi sesi Supabase untuk permintaan dari aplikasi dan signature Midtrans untuk notifikasi masuk.
3. Simpan `MIDTRANS_SERVER_KEY` dan `MIDTRANS_CLIENT_KEY` dari dashboard **Sandbox** di Edge Function Secrets. Client Key dikirim ke halaman chat untuk memuat Snap.js. Isi `MIDTRANS_SIGNATURE_SECRET` jika merchant memiliki secret signature yang terpisah. Jika menggunakan domain lain, isi `PAYMENT_RETURN_ORIGIN` serta izinkan origin itu di `APP_ORIGINS`. Domain kembali standar adalah `https://devm4tch.vercel.app`.
4. Isi Payment Notification URL di dashboard Midtrans Sandbox dengan `https://yxwktllqbmhustmhdaqi.supabase.co/functions/v1/payment-api/webhook`.
5. Deploy frontend ke project Vercel **dev-match-vincent**. Setelah login, Developer mengirim proposal melalui **Propose project** di composer chat. Client menerima proposal, lalu kedua pihak membuka **Project payments** pada kartu proposal untuk melihat status. Client dapat membayar DP dan pelunasan melalui Snap Sandbox.

Reviewer dispute memakai akun Supabase biasa dengan penugasan oleh admin. Untuk room proyek lama, isi ID percakapan, proyek, dan pengguna reviewer:

```sql
insert into public.payment_dispute_reviewers (conversation_id, project_id, reviewer_id)
values ('<uuid-room>', '<id-proyek>', '<uuid-user-reviewer>');
```

Untuk agreement dari proposal, tetapkan reviewer dengan ID agreement:

```sql
insert into public.payment_agreement_dispute_reviewers (agreement_id, reviewer_id)
values ('<uuid-agreement>', '<uuid-user-reviewer>');
```

Review muncul di tombol **Review dispute** saat penugasan menunggu keputusan. Tes repo menggunakan respons gateway tiruan dan PostgreSQL lokal.
