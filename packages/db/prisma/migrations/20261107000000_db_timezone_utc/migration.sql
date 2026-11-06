-- Prisma speichert DateTime als UTC in "timestamp without time zone".
-- Läuft die Sitzung in einer anderen Zeitzone (z. B. TZ=Asia/Hebron im Container),
-- verschieben Vergleiche mit Parametern in Roh-SQL um die Zonendifferenz.
-- Daher die Datenbank fest auf UTC stellen; Geschäftstage rechnet die Anwendung.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'UTC');
END
$$;
