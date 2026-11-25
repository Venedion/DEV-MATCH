# DEV-MATCH Midtrans Sandbox di Vercel

Frontend tetap memakai sesi Supabase yang sama dengan Room Chat. Proposal dari dialog **Propose project** menjadi sumber terms; saat Client menerima, terms dikunci dalam agreement dan pembayaran ditautkan ke agreement tersebut. Checkout memakai halaman Snap Sandbox dan status diverifikasi oleh backend. Refund, escrow, dan payout di DEV-MATCH adalah simulasi.

## Deploy

1. Terapkan migrasi proposal `202611240001_project_proposals.sql`, migrasi pembayaran lama `20261124120000_midtrans_sandbox_payments.sql` dan `20261125140000_payment_room_chat_context.sql`, serta `202611260001_proposal_agreement_payments.sql` ke proyek Supabase yang melayani frontend. Migrasi pembayaran agreement menghubungkan order dan status pembayaran ke agreement proposal, sementara tabel pembayaran proyek lama tetap dipertahankan.
2. Deploy fungsi `payment-api` dengan `supabase functions deploy payment-api --project-ref yxwktllqbmhustmhdaqi --no-verify-jwt`. Fungsi memvalidasi sesi Supabase untuk permintaan dari aplikasi dan signature Midtrans untuk notifikasi masuk.
3. Simpan `MIDTRANS_SERVER_KEY` dari dashboard **Sandbox** di Edge Function Secrets. Isi `MIDTRANS_SIGNATURE_SECRET` jika merchant memiliki secret signature yang terpisah. Jika menggunakan domain lain, isi `PAYMENT_RETURN_ORIGIN` serta izinkan origin itu di `APP_ORIGINS`. Domain kembali standar adalah `https://devm4tch.vercel.app`.
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
