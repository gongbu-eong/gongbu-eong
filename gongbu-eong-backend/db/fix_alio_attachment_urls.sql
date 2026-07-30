UPDATE public.job_posting_files
SET file_url =
  'https://www.alio.go.kr/download/download.json?fileNo=' ||
  substring(file_url FROM 'recrutAtchFileNo=([0-9]+)')
WHERE file_url LIKE 'https://opendata.alio.go.kr/recruit/downloadAtchFile%'
  AND substring(file_url FROM 'recrutAtchFileNo=([0-9]+)') IS NOT NULL;
