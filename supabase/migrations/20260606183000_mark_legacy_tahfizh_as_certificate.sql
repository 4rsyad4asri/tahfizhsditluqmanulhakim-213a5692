-- Mark legacy Tahfizh rows as Sertifikat without changing token or scores.
-- Safe to run repeatedly: only updates legacy rows that still lack tahfizhMode.
--
-- Preview impacted rows before running:
-- SELECT
--   id,
--   student_id,
--   tanggal,
--   assessed_by,
--   document_status,
--   verification_token,
--   nilai_akhir,
--   grade,
--   status,
--   nilai_aspek->>'assessorName' AS assessor_name,
--   jsonb_array_length(COALESCE(nilai_aspek->'surahEntries', '[]'::jsonb)) AS surah_entry_count
-- FROM public.ujian
-- WHERE mode = 'Tahfizh'
--   AND assessed_by = '846588ce-5957-4f00-811f-f03121226abe'
--   AND tanggal < DATE '2026-05-24'
--   AND COALESCE(nilai_aspek->>'tahfizhMode', '') = '';
--
-- Preview impacted count:
-- SELECT COUNT(*)
-- FROM public.ujian
-- WHERE mode = 'Tahfizh'
--   AND assessed_by = '846588ce-5957-4f00-811f-f03121226abe'
--   AND tanggal < DATE '2026-05-24'
--   AND COALESCE(nilai_aspek->>'tahfizhMode', '') = '';

UPDATE public.ujian
SET nilai_aspek = jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(nilai_aspek, '{}'::jsonb),
          '{tahfizhMode}',
          to_jsonb('Sertifikat'::text),
          true
        ),
        '{reportType}',
        to_jsonb('summary'::text),
        true
      ),
      '{verificationType}',
      to_jsonb('sertifikat-tahfizh'::text),
      true
    )
WHERE mode = 'Tahfizh'
  AND assessed_by = '846588ce-5957-4f00-811f-f03121226abe'
  AND tanggal < DATE '2026-05-24'
  AND COALESCE(nilai_aspek->>'tahfizhMode', '') = '';
