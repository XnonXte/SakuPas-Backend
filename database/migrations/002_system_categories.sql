INSERT INTO categories
    (user_id, name, slug, type, sublabel, icon, color, is_system, created_at, updated_at)
SELECT NULL, seed.name, seed.slug, seed.type, seed.sublabel, seed.icon, seed.color, TRUE,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
    ('Uang Saku', 'uang-saku', 'income', 'Transfer Orang Tua', 'ArrowDownLeft', '#387C6D'),
    ('Beasiswa', 'beasiswa', 'income', 'Beasiswa Kampus & Pemerintah', 'Award', '#387C6D'),
    ('Part-time & Freelance', 'part-time', 'income', 'Gaji Sampingan & Asdos', 'Briefcase', '#387C6D'),
    ('Pemasukan Lainnya', 'other-income', 'income', 'Hadiah, Cashback, dll', 'ArrowDownLeft', '#747B83'),
    ('Kebutuhan Pokok & Makan', 'groceries', 'expense', 'Warteg, Makan Harian & Kos', 'UtensilsCrossed', '#387C6D'),
    ('Transportasi On-Demand', 'transportation', 'expense', 'Grab, Gojek & Bensin', 'Navigation', '#343F56'),
    ('Lifestyle & Hiburan', 'lifestyle', 'expense', 'TikTok Shop, Kafe & Jajan', 'Sparkles', '#E9896A'),
    ('Kuliah & Akademik', 'education', 'expense', 'Fotokopi, Buku & Print', 'BookOpen', '#747B83'),
    ('Belanja Online', 'online-shopping', 'expense', 'Shopee, Tokopedia, TikTok', 'ShoppingBag', '#E9896A'),
    ('Tagihan & Langganan', 'bills', 'expense', 'Pulsa, Listrik Kos, Kuota', 'Receipt', '#343F56'),
    ('Lain-lain', 'other', 'expense', 'Pengeluaran Tak Terduga', 'CircleDot', '#747B83')
) AS seed(name, slug, type, sublabel, icon, color)
WHERE NOT EXISTS (
    SELECT 1 FROM categories existing
    WHERE existing.slug = seed.slug AND existing.user_id IS NULL
);
