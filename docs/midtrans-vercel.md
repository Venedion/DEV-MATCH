# DEV-MATCH Midtrans Sandbox di Vercel

Frontend tetap memakai sesi Supabase yang sama dengan Room Chat. Edge Function `payment-api` mengambil peran Client atau Developer dari peserta percakapan dan memeriksa proyek yang terkait. Checkout memakai halaman Snap Sandbox dan status diverifikasi oleh backend. Refund, escrow, dan payout di DEV-MATCH adalah simulasi.

## Deploy

1. Terapkan migrasi `20261124120000_midtrans_sandbox_payments.sql` dan `20261125140000_payment_room_chat_context.sql` di folder `supabase/migrations/` ke proyek Supabase yang melayani frontend. Migrasi menghubungkan pembayaran ke proyek dan percakapan, termasuk chat yang menggabungkan beberapa proyek dalam satu room.
2. Deploy fungsi `payment-api` dengan `supabase functions deploy payment-api --project-ref yxwktllqbmhustmhdaqi --no-verify-jwt`. Fungsi memvalidasi sesi Supabase untuk permintaan dari aplikasi dan signature Midtrans untuk notifikasi masuk.
3. Simpan `MIDTRANS_SERVER_KEY` dari dashboard **Sandbox** di Edge Function Secrets. Isi `MIDTRANS_SIGNATURE_SECRET` jika merchant memiliki secret signature yang terpisah. Jika menggunakan domain lain, isi `PAYMENT_RETURN_ORIGIN` serta izinkan origin itu di `APP_ORIGINS`. Domain kembali standar adalah `https://devm4tch.vercel.app`.
4. Isi Payment Notification URL di dashboard Midtrans Sandbox dengan `https://yxwktllqbmhustmhdaqi.supabase.co/functions/v1/payment-api/webhook`.
5. Deploy frontend ke project Vercel **dev-match-vincent**. Setelah login, buka percakapan Client dan Developer yang terkait proyek, lalu klik **Pembayaran**. Coba proposal, DP, dan pelunasan dari akun yang sesuai.

Reviewer dispute memakai akun Supabase biasa dengan penugasan per room oleh admin. Isi ID percakapan, proyek, dan pengguna reviewer sesuai penugasan:

```sql
insert into public.payment_dispute_reviewers (conversation_id, project_id, reviewer_id)
values ('<uuid-room>', '<id-proyek>', '<uuid-user-reviewer>');
```

Review muncul di tombol **Review dispute** saat proyek yang ditugaskan menunggu keputusan. Tes repo menggunakan respons gateway tiruan dan PostgreSQL lokal.
