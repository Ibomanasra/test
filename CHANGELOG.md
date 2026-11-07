# Changelog

## [0.19.3] – 2026-11-08 – Testbestellungen löschen

### Hinzugefügt
- **`bash scripts/delete-orders.sh`** (auf dem Server): macht zuerst ein Backup, listet alle Bestellungen, löscht nach Bestätigung **alle** oder **bestimmte Nummern** – samt Rechnungen, Zahlungen, Lieferscheinen, Zustellfirmen-Abrechnungen und Kundenkonto-Buchungen. Bestand wird zurückgebucht (Versand zurück, Reservierungen frei), Gutschein-/Angebotsnutzung freigegeben, Rückstands-Bestellungen mitgelöscht. Bei „alle“ auch übrige Test-Zahlungen und Mahnungen. Optional Nummernkreise ab 1 (je Belegart nur, wenn davon nichts mehr existiert). Produkte, Kunden und Einstellungen bleiben. Läuft im geschützten Wartungsmodus nur innerhalb dieser einen Transaktion.

## [0.19.2] – 2026-11-08

### Behoben
- **Tabellen auf Arabisch/Hebräisch: Zahlen standen nicht unter ihrer Überschrift** (Zahlen-Zellen wurden links- statt rechtsbündig ausgerichtet) – betrifft rund 110 Tabellenspalten, zentral behoben; Dashboard „المبيعات والتوصيل“ ebenso.
- Nummern und Beträge in Tabellen (z. B. „INV-2026-000156“, „84.70 ₪“, Datum) brechen nicht mehr über mehrere Zeilen um.

## [0.19.1] – 2026-11-08 – Mehr Besucher zum Konto bewegen

### Hinzugefügt
- **Streifen ganz oben für Gäste**: „🎁 خصم 10% على أول طلب – أنشئ حسابك مجاناً“ mit Knopf „إنشاء حساب“ (✕ blendet ihn 3 Tage aus). Der Rabatt kommt automatisch aus dem aktiven Willkommens-Angebot; ohne Angebot ein allgemeiner Text.
- **Einladungsfenster** nach dem 3. angesehenen Produkt oder nach 30 Sekunden: Rabatt, Bestellungen verfolgen, nachbestellen, Angebote zuerst; „إنشاء حساب مجاناً“ / „لدي حساب“ / „لاحقاً“ (3 Tage Ruhe). Höchstens einmal je Besuch, nie für eingeloggte Kunden, nie auf Anmelde-/Kassen-Seiten.
- Kopfzeile für Gäste: „إنشاء حساب“ als Hauptknopf (am PC), „تسجيل الدخول“ daneben.

## [0.19.0] – 2026-11-08 – Telegram-Benachrichtigungen (kostenlos)

### Hinzugefügt
- **Telegram-Bot** schickt kostenlos Nachrichten an Mitarbeiter oder eine Gruppe:
  - 🛒 **neue Bestellung**: Nummer, Kunde mit Telefon, Ort, Positionen, Betrag (inkl. Lieferkosten), Zahlungsart, Knopf „فتح الطلب“
  - ⚠️/⛔ **Bestand niedrig / ausverkauft** (10-%-Regel), Knopf „فتح المنتج“
  - 🏪 **neuer Händler** wartet auf Freigabe, Knopf „مراجعة“
- **Einstellungen → الإشعارات**: Bot-Token einfügen (wird bei Telegram geprüft, sicher gespeichert und nie wieder angezeigt), „بحث عن المحادثات“ findet Gruppen/Chats, je Chat die Nachrichtenarten wählen, Testnachricht. Browser-Benachrichtigungen dieses Geräts auf derselben Seite.
- `TELEGRAM_BOT_TOKEN` in `.env` optional (hat Vorrang).

## [0.18.1] – 2026-11-08 – Dashboard: Verkauf, Lieferung & Geld bei Zustellfirmen

### Hinzugefügt
- **Dashboard ganz oben „المبيعات والتوصيل“**: für heute, diese Woche und diesen Monat getrennt **Warenwert (Verkaufspreis)**, **Liefergebühren** und **Gesamt**, mit Anzahl der Bestellungen.
- Daneben die Karte **„المطلوب من شركات التوصيل“**: wie viel die Zustellfirmen schon kassiert haben und uns geben müssen (groß), wie viel noch unterwegs ist, Aufteilung je Firma, Link „استلام المال“ zur Abrechnung.

## [0.18.0] – 2026-11-08 – Bestandsschutz, nur Rechnungen, Produkte am Handy

### Hinzugefügt
- **Nie mehr verkaufen als vorhanden**: Schon beim Hinzufügen/Erhöhen im Warenkorb wird geprüft; sonst „المتوفر في المخزن X فقط“. (An der Kasse war es bereits gesperrt.) Bestelllisten überspringen nicht verfügbare Positionen.
- **Warnung bei 10 %**: Nach jeder Auffüllung (Wareneingang, Korrektur +, Inventur) wird der Mindestbestand automatisch auf 10 % des verfügbaren Bestands gesetzt (z. B. 100 → 10). Fällt der Bestand durch Bestellungen oder Abgänge darauf oder darunter, bekommen Lager/Büro **einmal** eine Push-Nachricht „⚠️ مخزون منخفض“ bzw. „⛔ نفد من المخزون“ (Tippen öffnet das Produkt). Von Hand gesetzte Mindestbestände bleiben unverändert; 0 = automatisch.
- **Produkte am Handy**: 2 Produkte nebeneinander, großes Foto mit Angebots-/Bestandsschild, Name, Preis groß, Mengen-Stepper „− 1 +“ und runder Warenkorb-Knopf.

### Geändert
- **Belege: nur Rechnungen** – Kundenkonto „Dokumente“ und Bestellseite zeigen nur Rechnungen; im Admin keine Auftragsbestätigung/Kommissionierliste/Lieferschein-Knöpfe mehr, Sammeldruck nur Rechnungen, Dokumente-Seite nur Rechnungen, Dokument-Einstellungen nur für die Rechnung. (Gutschriften laufen für Rückgaben weiter im Hintergrund.)

## [0.17.0] – 2026-11-08 – Lieferung nur über Zustellfirmen & Abrechnung des Nachnahme-Gelds

### Geändert
- **Eigene Fahrer ausgeblendet** (Lieferung läuft über externe Zustellfirmen): Menüpunkt „Lieferung & Fahrer“, Fahrerauswahl beim Übergeben, Fahrer-Kassenabschluss und Fahrer-Kacheln auf Dashboard/Finanzen sind weg. Schalter „لدينا سائقون خاصون أيضاً“ unter Einstellungen → Zustellfirmen bringt alles zurück (Standard: aus).
- Dashboard: statt „Bargeld bei Fahrern“ jetzt „Bei der Zustellfirma“ (Anzahl), „Unterwegs“ führt zur Bestellliste.

### Hinzugefügt
- **Abrechnung mit der Zustellfirma**: Die Firma kassiert bei Nachnahme den Rechnungsbetrag beim Kunden. Beim Übergeben merkt sich das System den zu kassierenden Betrag (in der Liste „💵 يحصّل …“).
- **Finanzen → شركات التوصيل**: je Firma „unterwegs“ und **„يجب أن يدفعوا لنا“** (zugestellt und kassiert, Geld noch nicht bei uns) mit Liste der Bestellungen. **„استلمنا …“** bucht für jede gewählte Bestellung die Zahlung auf die Rechnung (Kunde = bezahlt, Quittung) und schließt die Abrechnung; Verlauf der früheren Abrechnungen.
- Finanz-Übersicht: neue Kachel „عند شركات التوصيل“ (Geld, das die Firmen noch geben müssen) und Aktion „استلام المال من شركة التوصيل“.

### Behoben
- Doppelter Import in einem E2E-Test aus 0.16.2.

## [0.16.2] – 2026-11-08 – Bestellung vorbereiten mit Foto & Beschreibung

### Hinzugefügt
- **Bestellpositionen mit Foto, Beschreibung, Barcode und Lagerplatz** (📍 z. B. A-01-1) auf der Bestellseite – Foto antippen öffnet es groß, Name führt zum Produkt. So findet man das Produkt im Lager schneller.
- **Abhaken beim Vorbereiten**: In Schritt 2 hat jede Position ein großes Kästchen „تم إحضاره“; der Haken bleibt auf diesem Gerät gespeichert (auch nach Neuladen).
- Menge am Handy groß direkt beim Produkt (die Mengenspalte war sonst außer Sicht).
- **Positionen bearbeiten**: beim Ändern einer Bestellung zeigt jede Zeile Foto und Namen des gewählten Produkts.
- Kunden-API liefert zur Position das Foto (Lagerplatz bleibt intern).

## [0.16.1] – 2026-11-08 – Angebote exakt, Produktliste, Ware & Lieferung getrennt

### Behoben
- **Angebotspreise gelten exakt wie eingegeben**: Ein Festpreis von 10 ₪ ist 10,00 ₪ (vorher wurde durch die „,90“-Rundung 10,90 daraus); 10 % Rabatt sind genau 10 % (vorher konnte ein 10-%-Angebot auf 8,90 durch Aufrunden wieder 8,90 ergeben = gar kein Rabatt). Die Beispiel-Rundungsregel gilt nicht mehr für Angebote (Migration); wer sie wieder einschaltet, bekommt nur noch **Ab**rundung zugunsten des Kunden, Festpreise bleiben immer exakt.
- Angebotsseite am Handy war breiter als der Bildschirm.

### Hinzugefügt
- **Angebote → „Produkte in Angeboten“**: Liste aller Produkte mit laufendem oder geplantem Angebot – Foto, Name, welches Angebot (auch über Kategorie), **Normalpreis durchgestrichen → Preis, den der Kunde wirklich zahlt** (Endkunde und Händler), Status und Enddatum.
- **Verkaufspreis und Lieferkosten getrennt**: In der Bestellliste unter dem Gesamtbetrag „Ware X · Lieferung Y“ (oder „kostenlos“), auf der Bestellseite (Admin und Kunde) eigene Zeilen „سعر البضاعة“ und „التوصيل“, auch im Tabellendruck.

## [0.16.0] – 2026-11-08 – Hebräisch & Konto erstellen beim Bestellen

### Hinzugefügt
- **Hebräisch (עברית) als dritte Sprache**: Shop, Kundenkonto, Admin, Fahreransicht und Fehlermeldungen vollständig übersetzt (rund 1.900 Texte), von rechts nach links wie Arabisch, mit hebräischer Schrift (IBM Plex Sans Hebrew, lokal). Adressen `/he/…`.
- Sprachauswahl jetzt als Auswahlfeld: **العربية · English · עברית** (überall: Shop, Admin, Anmeldung).
- Kunden können Hebräisch als bevorzugte Sprache haben (Datenbank-Migration); SMS-Texte für Code und Händler-Freigabe auch auf Hebräisch.
- Neue Texte ohne Hebräisch fallen automatisch auf Englisch zurück; `scripts/i18n/add-messages.py` nimmt optional eine 4. Spalte (Hebräisch).
- **„Neues Konto erstellen“ gut sichtbar beim Bestellen**: Gäste sehen im Warenkorb einen großen Knopf „إنشاء حساب جديد وإتمام الطلب“ (plus „لدي حساب – تسجيل الدخول“); die Anmeldeseite zeigt oben einen auffälligen Kasten „زبون جديد؟“. Nach der Registrierung geht es **direkt zur Kasse**, der Warenkorb bleibt erhalten.

### Hinweis
- Produktnamen, Kategorien und Belege (PDF) gibt es weiterhin auf Arabisch/Englisch.

## [0.15.0] – 2026-11-08 – Bestellungen in 3 Schritten & schneller Warenkorb

### Geändert
- **Bestellablauf in 3 klaren Schritten**: **1 تأكيد** (bestätigen) → **2 تم التجهيز** (vorbereitet, ein Klick statt „Kommissionierung starten“ + „Bereit“) → **3 تسليم لشركة التوصيل** (an die Zustellfirma übergeben). Reiter in der Bestellliste heißen jetzt nach den Schritten („1 للتأكيد“, „2 للتجهيز“, „3 جاهز للتسليم“, „عند شركة التوصيل“).
- Schritt 3 direkt aus der Liste (auch **mehrere Bestellungen auf einmal**): Firma antippen oder „＋ شركة جديدة“ eintippen → Lieferschein + Rechnung entstehen automatisch.
- Bei Bestellungen „bei der Zustellfirma“ steht der Firmenname in der Liste; **„وصل للزبون“** (zugestellt) mit einem Klick.
- Bestellseite: Schrittanzeige 1-2-3 und große Knöpfe; Teillieferung/eigener Fahrer unter „optional“.

### Hinzugefügt
- **Zustellfirmen** (Einstellungen → شركات التوصيل): anlegen, bearbeiten, ausschalten; Anzeige, wie viele Bestellungen gerade bei jeder Firma sind. Lieferschein merkt Firma, Sendungsnummer (optional) und Übergabezeit.
- **Warenkorb sofort**: Der Zähler im Kopf ändert sich beim Hinzufügen sofort (mit kleiner Animation), dazu eine moderne Bestätigung mit Foto, Menge, Korbsumme und „عرض السلة“.
- Nach dem Bestellen ist der Korb-Zähler **sofort leer**.

### Behoben
- Bestellliste am Handy war breiter als der Bildschirm (versteckte Filter und Tabellen-Beschriftung ragten heraus).

## [0.14.1] – 2026-11-08

### Behoben
- **Produktfotos am Handy**: Beim neuen Produkt öffnete sich nur die Kamera. Jetzt gibt es **„🖼️ من المعرض“** (Galerie, mehrere Fotos auf einmal) und **„📷 التقاط صورة“** (Kamera); das große Feld bietet wieder die normale Auswahl.

## [0.14.0] – 2026-11-08 – Benachrichtigungen aufs Handy (kostenlos)

### Hinzugefügt
- **Browser-Benachrichtigungen (Web Push)** – kostenlos, ohne App-Store und ohne Fremdanbieter-Konto. Funktioniert auf Android (Chrome), am PC und auf dem iPhone (iOS 16.4+, nachdem die Seite „Zum Home-Bildschirm“ hinzugefügt wurde).
- **Neue Bestellung** → alle Mitarbeiter, die Bestellungen bestätigen dürfen, bekommen „🛒 طلب جديد“ mit Kunde und Betrag; Tippen öffnet die Bestellung.
- **Neue Lieferung für den Fahrer** → beim Laden mit Fahrer, bei neuer Tour und beim Hinzufügen von Stopps bekommt der Fahrer „🚚 …“; Tippen öffnet „جولتي“.
- Schalter **„تفعيل الإشعارات“** auf dem Dashboard, in der Kopfzeile und in der Fahreransicht, mit **Testnachricht**; Hinweis für iPhone und für blockierte Benachrichtigungen.
- Web-App-Manifeste für Shop, Büro und Fahrer (als App auf dem Home-Bildschirm, startet direkt am richtigen Ort).
- Die nötigen Schlüssel (VAPID) werden automatisch erzeugt und in der Datenbank gespeichert – auf dem Server ist nichts einzurichten.

## [0.13.1] – 2026-11-07 – Fahrer beim Laden auswählen

### Hinzugefügt
- **Fahrer gleich beim Laden wählen**: Im Laden-Dialog einer fertigen Bestellung gibt es die Auswahl „السائق“. Der Lieferschein kommt automatisch in die **heutige Tour** dieses Fahrers (gibt es noch keine, wird sie angelegt); der Fahrer bekommt eine Push-Nachricht. „Ohne Fahrer – später“ verhält sich wie bisher.
- Auf der Bestellseite steht beim Lieferschein jetzt **welcher Fahrer** ihn hat (mit Link zur Tour).

## [0.13.0] – 2026-11-07 – Produkte einfach verwalten & moderner Einkauf

### Hinzugefügt
- **Produkte ein-/ausblenden mit einem Schalter** und **löschen**: nie verwendete Produkte werden gelöscht, bereits verkaufte **archiviert** (überall ausgeblendet, Belege bleiben gültig). Filter „sichtbar / ausgeblendet / archiviert“.
- **Produktliste neu**: Foto, Name, Endkunden- und Händlerpreis, Bestand mit Warnfarbe, Schalter, Bearbeiten, Löschen; Selteneres unter „mehr“.
- **Produktseite = ein Ort für alles**, in klarer Reihenfolge: Kopf (Foto, sichtbar-Schalter, Löschen) → **Preis & Bestand** direkt bearbeiten (Bestand ＋/−) → Fotos (mehrere auf einmal) → **Angebote für dieses Produkt** (mit „Neues Angebot“, Produkt vorausgewählt) → Name/Kategorie/Beschreibung → „Erweitert“ (Einheiten, Varianten, Barcodes).
- **Warenkorb neu**: Produktfotos, Menge mit −/＋, feste Zusammenfassung, Fortschrittsbalken „noch X ₪ bis Y % Rabatt“, schöner leerer Warenkorb.
- **Kasse neu**: Schritte (Warenkorb → Lieferung & Zahlung → Fertig), nummerierte Abschnitte, Liefertage als Kacheln („nächster Termin“), Zahlungsarten mit Symbolen, Bemerkung einklappbar, Zusammenfassung mit Produktfotos; am Handy feste Leiste mit Summe und „Bestellung bestätigen“. Erfolgsseite mit Haken.

## [0.12.0] – 2026-11-07 – Kunden-Login ohne SMS & Handy-Menü

### Geändert
- **Kunden melden sich mit Telefonnummer + Passwort an** – ohne SMS-Code, ohne Kosten (Web und App). Registrierung direkt mit Telefon, Passwort und Adresse.
- **Passwort vergessen**: Link per E-Mail (wenn hinterlegt) oder Knopf „per WhatsApp melden“ an die Firmennummer; im Admin auf der Kundenseite **„Neues Passwort setzen“**.
- Mit `CUSTOMER_LOGIN_OTP=true` lässt sich der frühere SMS-Code-Login wieder einschalten.
- Demo-Kunden haben das Demo-Passwort (`Demo-2026-pass`).
- **Handy-Menü der Verwaltung**: seitliche Schublade, die sich nach dem Antippen eines Punkts, beim Tippen daneben und mit Esc schließt.

## [0.11.0] – 2026-11-07 – Produkt schnell anlegen & neue Startseite

### Hinzugefügt
- **Neues Produkt in einem Schritt** (Produkte → Neu): Fotos (mehrere, auch direkt mit der Handykamera), Name, Kategorie – oder **neue Kategorie direkt eintippen** –, Endkunden- und Händlerpreis, Einkaufspreis, „auch im Karton zu X Stück“, Anfangsbestand. Artikelnummer (P-0001 …), Link und Verkaufseinheiten setzt das System selbst. „Speichern und nächstes Produkt“ für schnelles Erfassen. Das bisherige Formular bleibt als „Erweitertes Formular“.
- **Startseite neu**: dunkler Kopf in Logofarben mit Hinweis „Lieferung in alle Städte der Westbank“, starker Überschrift, Knöpfen „Jetzt einkaufen“, „🔥 Angebote“, „Als Händler registrieren“ und Vertrauenszeichen. Hintergrund: eigenes Bild → sonst Collage echter Produktfotos → sonst Illustration.
- **Einstellungen → واجهة المتجر**: Hintergrundbild hochladen/entfernen, Überschrift und Text (Arabisch/Englisch) ändern.

## [0.10.1] – 2026-11-07 – Admin-Login mit Benutzername

### Geändert
- **Mitarbeiter und Admin melden sich mit Benutzername + Passwort an** – ohne Handynummer und ohne SMS-Code (Web und App). Kunden bleiben bei Telefon + SMS-Code.
- Neues Feld **Benutzername** in der Mitarbeiterverwaltung (eindeutig, a–z, 0–9, . _ -). Bestehende Konten: Inhaber → `admin`, übrige automatisch; Demo-Mitarbeiter heißen `sami`, `laila`, `khaled`, `yousef`, `mona`.
- Die Anmeldung mit Telefonnummer statt Benutzername funktioniert weiterhin.
- Optional wieder mit SMS-Code: `STAFF_LOGIN_OTP=true`.
- Installationsskript fragt den Admin-Benutzernamen; neue Einstellung `SEED_OWNER_USERNAME`.

### Hinzugefügt
- `scripts/admin-reset.sh`: Admin-Benutzername und -Passwort auf dem Server neu setzen (hebt auch Sperren durch Fehlversuche auf).

## [0.10.0] – 2026-11-07 – Produktion & Twilio

### Hinzugefügt
- **Produktionsbetrieb**: `docker-compose.prod.yml` mit **Caddy** (automatisches HTTPS über Let's Encrypt, HSTS, gzip/zstd), Datenbank/MinIO/Web nicht mehr direkt erreichbar, kein Mailpit, echter SMTP-Server.
- **`scripts/server-install.sh`**: frischer Ubuntu-Server in einem Schritt – Docker, Firewall (nur 22/80/443), `.env` mit sicheren Zufallswerten (fragt nur Domain, Handynummer, Passwort, Name), Prüfung, Start, tägliches Backup per Cron.
- **`scripts/server-update.sh`**: Backup → `git pull` → Prüfung → neu bauen und starten.
- **`scripts/check-prod-env.mjs`**: verhindert den Start mit Demo-Passwörtern, festem OTP-Code, ohne HTTPS-Cookies usw.; warnt bei fehlender SMS/E-Mail.
- **Twilio** als SMS-Anbieter (`SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` – Nummer, Absendername oder Messaging-Service); Fehlercodes von Twilio landen im Benachrichtigungsprotokoll.
- **VEROEFFENTLICHEN.md**: Schritt-für-Schritt-Anleitung (Server mieten, Domain, Twilio, Installation, Alltag).

## [0.9.2] – 2026-11-07 – Rechnungen & Belege verständlich

### Geändert
- **Neue A4-Vorlage** für alle Belege in den Logofarben (Anthrazit/Rot): großes Logo, Dokumentkasten mit Titel, Nummer und QR, Eckdaten als Leiste, Tabellen mit dunklem Kopf und Zebrastreifen, Summen als Kasten.
- **Großer Betrags-Kasten** oben mit dem Wichtigsten in einem Satz:
  - Rechnung: „Zu zahlen … ₪ – bitte bis … zahlen“ bzw. „bar an den Fahrer“; auf Kopien zusätzlich der Status (offen, teilweise bezahlt, überfällig, bezahlt ✓, gutgeschrieben). Das eingefrorene Original zeigt bewusst keinen Status.
  - Quittung „Betrag erhalten ✓“, Kontoauszug „Ihr offener Saldo“ (mit Überfällig-Anteil), Mahnung „Zu zahlen bis …“, Auftragsbestätigung/Angebot „Gesamtbetrag“, Lieferschein „Bei Lieferung zu zahlen“, Gutschrift „Betrag der Gutschrift“.
- **„So bezahlen Sie per Überweisung“**: Bankkonten mit IBAN und Hinweis, welche Nummer in den Verwendungszweck gehört (Rechnung auf Ziel/Überweisung, Kontoauszug, Mahnung).
- Rechnung zeigt **bezahlt / gutgeschrieben / noch offen** in den Summen.
- Weniger Spalten: Artikelname mit SKU darunter, Menge mit Einheit („2 × Karton (10)“); ohne MwSt. (0 %) entfallen Netto-/MwSt.-Spalten und -Zeilen, stattdessen ein klarer Hinweis.
- Kontoauszug: „Rechnungen (an Sie)“ / „Zahlungen & Gutschriften“ statt Soll/Haben.
- Zweisprachig kompakter (Englisch in derselben Zeile), Telefonnummern im arabischen Text richtig herum, Dankeszeile.

## [0.9.1] – 2026-11-07 – Eigenes Logo

### Geändert
- **Firmenlogo** (Haus mit Kalligrafie „شعلة الجنوب“) ersetzt das bisherige Zeichen: Shop-Kopf, Admin-Seitenleiste (helle Variante), Anmeldeseiten, Favicon/Apple-Icon, Standardlogo auf allen A4-Dokumenten, App-Icon, adaptives Android-Icon, Splash und App-Anmeldung.
- Icons zeigen das Haus mit Fenster und den drei roten Quadraten aus dem Logo (Schrift wäre in Icon-Größe nicht lesbar).
- Dateien: `apps/web/public/brand/{logo,logo-light,mark}.png`.

## [0.9.0] – 2026-11-07 – Angebotszentrum

### Hinzugefügt
- **Angebotszentrum** (Verwaltung → العروض, auch unter Einstellungen verlinkt): alle Angebote an einem Ort. „Neues Angebot“ fragt zuerst den Typ ab und zeigt dann nur die nötigen Felder plus eine Live-Vorschau „So sieht es der Kunde“.
  - Auf die ganze Bestellung: **Willkommensrabatt** (erste Bestellung, automatisch), **Rabatt ab Bestellwert** (mehrere Stufen möglich), **Gutschein-Codes** (%, ₪, Mindestwert, Gesamt- und Pro-Kunde-Limit), **Gratis-Lieferung** als Aktion.
  - Auf Produkte (bisherige Aktionen, jetzt einfacher): Rabatt auf Produkt oder Kategorie, Sonderpreis, „X kaufen – Y gratis“.
  - Karten mit Status (aktiv, geplant, abgelaufen, pausiert, aufgebraucht), Nutzungszähler, Pausieren mit einem Klick.
- **Im Shop**: Menüpunkt „🔥 العروض“ mit eigener Angebotsseite, Angebots-Banner auf der Startseite, rote Schilder an Produkten (−15 %, 10 + 1), „endet in X Tagen“.
- **Kasse**: Gutschein-Feld mit verständlichen Meldungen (angewendet, abgelaufen, Mindestwert …), Rabattzeile, Gratis-Lieferung, Hinweis „noch X ₪ bis Y % Rabatt“. Rabatt auch in der Bestellansicht für Kunde und Verwaltung.
- Demo-Daten: Willkommensrabatt 10 %, 5 % ab 400 ₪, Gutschein `SHOLA15`.

### Technik
- Neue Tabellen `OrderOffer`, `OrderOfferRedemption`; Bestellung speichert Angebot, Rabatt und Gutschein.
- Je Bestellung höchstens ein Warenrabatt (der beste für den Kunden), Gratis-Lieferung zusätzlich. Der Rabatt wird anteilig auf die Stückpreise verteilt – Rechnung, MwSt. und Marge bleiben ohne Sonderzeile korrekt. Mindestbestellwert gilt vor Rabatt.
- Einlösungen werden in der Bestell-Transaktion gebucht (Limit atomar geprüft) und bei Storno freigegeben.
- Kernlogik in `@sa/core/offers` mit Unit-Tests; E2E für Gutschein-Einlösung und Storno.

## [0.8.1] – 2026-11-07 – Finanzen einfach

### Geändert
- **Finanzen neu gegliedert** in einfacher Sprache: *Übersicht* → *Wer schuldet uns?* → *Zahlungen* → *Rechnungen*; Rückgaben, Zahlungserinnerungen und „Export für den Steuerberater“ unter „mehr“.
- **Übersicht**: vier Zahlen (Kunden schulden uns, davon überfällig, heute eingegangen, diesen Monat eingegangen + Bargeld bei Fahrern), große Knöpfe „Was möchtest du tun?“, größte offene Beträge mit Zahlungsknopf, letzte Zahlungseingänge.
- **Wer schuldet uns?**: eine Zeile je Kunde mit offenem Betrag, „X ₪ seit N Tagen überfällig“, farbigem Altersbalken, Knöpfen „Zahlung erfassen“ und „Kontoauszug“; Filter „nur überfällige“.
- **Zahlung erfassen in drei Schritten**: Wer hat bezahlt? (Suche, Schuldner zuerst) → Für welche Rechnungen? (ankreuzen, Betrag wird übernommen; ohne Auswahl älteste zuerst; „alles bezahlen“) → Wie viel und wie? (Bar, Überweisung, Karte). Danach Quittung drucken.
- Mahnlauf auf die Seite „Zahlungserinnerungen“ verschoben.

## [0.8.0] – 2026-11-07 – Verwaltung für die tägliche Arbeit

### Hinzugefügt
- **Dashboard neu**: Begrüßung mit Schnellaktionen, vier Kennzahlen (Umsatz heute ggü. gestern, Bestellungen heute, zu bearbeiten, überfällige Rechnungen), Umsatzverlauf 14 Tage (Endkunden/Händler gestapelt, Werte beim Überfahren, Tabellenansicht), Liste „Braucht deine Aufmerksamkeit“, Bestell-Pipeline, neueste Bestellungen, Top-Produkte des Monats.
- **Bestellungen als Arbeitsliste**: Reiter je Status mit Zählern (Standard: offene), Suche, Schnellfilter „Lieferung heute/morgen“, Liefertag-Hinweis (heute/morgen/verspätet), Knopf für den nächsten Schritt direkt in der Zeile (Bestätigen → Kommissionieren → Bereit), Sammel-Weiterschalten und Sammeldruck.
- **Kunden-Stammdaten bearbeiten** (Recht `customer.edit`): Name, Firma, Inhaber, Händlernummer, Telefon (= Anmeldenummer des Inhabers, mit Dublettenprüfung), E-Mail, Sprache; Adressen hinzufügen, ändern, löschen, Standardadresse setzen – alles im Audit-Log.
- **Preise in der Zeile pflegen**: Einkauf, Endkundenpreis und Händlerpreis direkt in der Tabelle, Marge live, Speichern mit Enter; Rückfrage unter Mindestmarge. Regelwerk (Gruppen, Preislisten, Staffeln …) unter „Erweiterte Einstellungen“.
- **MwSt.-Schalter** (Einstellungen → Steuer): ab sofort ein/aus, z. B. 0 % ↔ 16 %; ausgestellte Belege behalten ihren Satz.

### Geändert
- **MwSt. vorerst 0 %**: Migration beendet den bisherigen Satz jetzt und setzt 0 % (neue Datenbanken: `SEED_VAT_BPS`, Standard 0). Endkundenpreise bleiben Endpreise; Händlerpreise sind netto.
- **Ort frei eingeben**: Registrierung, Kasse, App und Verwaltung nehmen jeden Ort (mit Vorschlägen); die Lieferzone ist optional und wird über den Ortsnamen zugeordnet, sonst in die neue Sammelzone „مناطق أخرى“ (Gebühren in Einstellungen → Lieferzonen änderbar). Die Verwaltung kann die Zone je Adresse ändern.

### Behoben
- Datenbank-Sitzungen laufen jetzt in UTC (Migration). Mit `TZ=Asia/Hebron` im Postgres-Container waren Zeitvergleiche in Berichten/Dashboard um 2–3 Stunden verschoben (z. B. „Umsatz heute“ nach Mitternacht 0).

## [0.7.1] – 2026-11-06 – Logo & Startseite

### Hinzugefügt
- **Logo „Glut“**: Flamme auf dunkler Kachel (شعلة الجنوب = Flamme des Südens) mit arabischer und lateinischer Wortmarke – im Shop-Kopf, in der Admin-Seitenleiste, auf den Anmeldeseiten, als Favicon/Apple-Icon, als Standardlogo auf allen A4-Dokumenten (bis ein eigenes Logo hochgeladen wird) und als App-Icon.
- **Startseite**: beim Scrollen Angebote und je Kategorie eine Reihe Produkte (mit Preis für den Kanal des Besuchers und „In den Warenkorb“), „Alle anzeigen“ je Kategorie.

### Geändert
- Produktkarte als gemeinsame Komponente für Katalog und Startseite.
- Windows: `pnpm dev` startet direkt, Projektpfad und `.env` werden plattformunabhängig gelesen; Einrichtung mit `pnpm setup:dev` (siehe TESTEN.md).

## [0.7.0] – 2026-11-06 – Restpunkte

### Hinzugefügt
- **Passwort vergessen** für Mitarbeiter: Link per E-Mail (SMTP, Mailpit in Entwicklung), 30 Minuten gültig, einmalig, beendet alle Sessions.
- **SMS-/WhatsApp-Adapter**: generischer HTTP-SMS-Anbieter und WhatsApp Business Cloud API; Login-Codes im Protokoll geschwärzt; Statusmeldungen blockieren nie.
- **Erstattung auf die Karte** über die Gateway-API (PayTabs, Arab Bank/MPGS, Test-Gateway); neuer Intent-Status `REFUNDED`.
- **App**: Unterschrift mit dem Finger und Foto als Zustellnachweis; Nachweise im Admin sichtbar (SVG wird serverseitig aus Pfaddaten gebaut und mit Sandbox-CSP ausgeliefert).
- **Push-Benachrichtigungen** (Expo): Bestellstatus an Kunden, neue Tour an Fahrer; Geräte-Registrierung `/api/v1/me/push-token`.
- **Aufräum-Job**: alte Rate-Limit-Zähler, OTP-Challenges und Sessions.
- Tests: Adapter (SMS, WhatsApp, Push, Erstattungen) und E2E (Passwort-Reset, Zustellnachweis, Push-Token, Erstattung).

### Behoben
- CI: Web-Build hatte seine `NODE_ENV`-Einstellung verloren (doppelter `env`-Schlüssel); E2E-Job startet jetzt Mailpit.

## [0.6.0] – 2026-10-27 – Phase 6: Mobile-App & Zahlungs-Gateway

### Hinzugefügt
- **Zahlungs-Gateway-Adapter**: `paytabs` (Hosted Payment Page, signierte Callbacks, Statusabfrage), `arabbank` (Mastercard Gateway Hosted Checkout), `fake` für Entwicklung/Tests – mit Unit-Tests gegen simulierte Anbieter-Antworten.
- **Kartenzahlung** im Checkout (Web und App): PaymentIntent, Weiterleitung zur Bezahlseite, Rückkehrseite mit Statusprüfung, „Jetzt bezahlen“ für offene Kartenbestellungen, automatische Stornierung nach Zeitüberschreitung; vorausbezahlte Rechnungen werden beim Versand mit Quittung ausgeglichen.
- **Mobile-App** (`apps/mobile`, Expo SDK 58): Kunden (SMS-Login, Registrierung, Katalog, Warenkorb, Bestellung inkl. Karte, Bestellungen, PDF-Belege, Sprache AR/EN mit RTL) und Fahrer (Touren, Anruf/Karte/Lieferschein, Zustellung mit Bargeld, Nicht-Zustellung, Kassenabschluss).
- CI erzeugt das Android-JavaScript-Bundle der App; E2E für Kartenzahlung (bezahlt/abgelehnt, gefälschter Callback).

## [0.5.0] – 2026-10-27 – Phase 5: Verwaltung

### Hinzugefügt
- **Lager**: Bestandsübersicht (verfügbar/reserviert, Mindestbestand, Lagerwert), Lagerjournal, Bestandskorrektur mit Grund, Lagerplätze mit Laufweg, Lagerplatz je Artikel, **Inventur** (eingefrorene Soll-Mengen, blinde Zählung, Abschluss bucht Differenzen) mit Zählliste.
- **Einkauf**: Lieferanten, Einkaufsaufträge (Entwurf → bestellt → teilweise/vollständig geliefert), **Wareneingang** mit Lagerplatz und Einstandspreis-Aktualisierung (gleitender Durchschnitt oder letzter Preis, mit Preis-Historie), Einkaufsbestellung als PDF.
- **Lieferung**: Tourenplanung (Datum, Fahrer, Gebiet, Lieferscheine, Reihenfolge), Nachnahme-Soll je Stopp, Tourenliste; **Fahreransicht** fürs Handy (Anruf, Karte, Lieferschein, Zustellung mit Empfänger, Unterschrift und Bargeld, Nicht-Zustellung mit Grund); **Kassenabschluss** pro Fahrer und Tag (Stückelung, Soll/Ist/Differenz, Freigabe).
- **Finanzen**: Zahlungen mit automatischer oder gezielter Zuordnung (Quittung RC-…), Storno per Gegenbuchung; **offene Posten** mit Altersstruktur; **Mahnlauf** Stufe 1–3 mit optionaler Gebühr; **Retouren** mit Wiedereinlagerung und Gutschrift; **Export** für den Steuerberater (Rechnungen, Gutschriften, Zahlungen, Kundenjournal als Excel/CSV).
- **Berichte**: Umsatz und Marge nach Kanal, Kategorie, Produkt, Kunde, Gebiet, Monat; Top/Flop 20; Lagerwert – als Tabelle, PDF (A4), Excel und CSV.
- Admin-Kundendetail: Umsatz im Jahr, offene/überfällige Posten, letzte Bestellungen, alle Belege, Kontoauszug und Preisliste drucken.
- Alle Admin-Module sind umgesetzt (keine Phasen-Platzhalter mehr).
- E2E: Einkauf → Wareneingang, Fahrer-Zustellung mit Bargeld und Kassenabschluss (Handy-Ansicht), Zahlung/Zuordnung/Storno, Inventur über die Oberfläche, Berichte und Export.

### Behoben
- Tour- und Kassenabschluss-Datum wurden um einen Tag versetzt gespeichert (Zeitzone).

## [0.4.0] – 2026-10-27 – Phase 4: A4-Dokumente

### Hinzugefügt
- **`packages/pdf`**: Vorlage-Engine (HTML/CSS → Chromium-PDF) mit eingebetteter arabischer Schrift, Kopf (Logo, Firma AR/EN, Händlernummer), Fuß (Bankdaten, „Seite X von Y“), wiederholtem Tabellenkopf, ungeteilten Zeilen, Summen auf der letzten Seite, QR-Code, Code-128-Barcodes, Sprachen AR / EN / zweisprachig, Etikettenbogen 3 × 8, PDF-Zusammenführung. Test „Arabisch korrekt verbunden“ (PDF erzeugen, Text extrahieren, Schrift prüfen).
- **Alle 15 Dokumente**: Angebot, Auftragsbestätigung, Kommissionierliste, Lieferschein (mit/ohne Preise, Unterschriften Kunde/Fahrer), Steuerrechnung, Quittung, Gutschrift, Tourenliste, Kassenabschluss, Kontoauszug, Mahnung (Stufe 1–3), Einkaufsbestellung, Preisliste (pro Kunde mit persönlichen Preisen oder pro Gruppe), Inventur-Zählliste, Bestandsliste; Berichte/Listen über den generischen Listendruck.
- **Rechnungen je Lieferschein** beim Übergang „Unterwegs“ in derselben Transaktion (lückenlose INV-Nummern), Buchung im Kundenjournal, Snapshot von Verkäufer- und Kundendaten; fehlgeschlagene Zustellung storniert automatisch per Gutschrift.
- **Gutschriften** (voll oder je Position/Menge) mit lückenlosen CN-Nummern; **Archiv**: Rechnung und Gutschrift werden beim Erstellen als PDF eingefroren (SHA-256), Nachhol-Job.
- **Druck**: „Drucken / PDF (A4)“ an allen Belegen und Listen (Vorschau im Browser, EN, zweisprachig, Download), Sammeldruck mehrerer Bestellungen, „Lieferschein + Rechnung“, Barcode-Etiketten, Auto-Druck bei Statuswechsel mit Druckauftrags-Liste.
- Admin-Menü **Dokumente**: Rechnungen, Gutschriften (mit Erstellung), Druckaufträge.
- **Einstellungen → Dokumente**: Logo-Upload, Bankkonten, Dokumenttexte AR/EN je Belegart, Nummernkreise (Präfix/Stellen, für Rechnungen nach erster Nummer gesperrt), Auto-Druck-Regeln, Hinweise der Steuerrechnung.
- Kundenkonto: Belege als PDF, Kontoauszug mit Zeitraum, persönliche Preisliste.
- Docker-Image enthält Chromium und die PDF-Schriften.
- E2E: Rechnung beim Versand (lückenlos, eingefroren, unveränderlich, Journal), Zugriff Kunde/Fremdkunde/Gast, Sammel-PDF, Teil-Gutschrift über die Oberfläche, Nummernkreis-Sperre, Listendruck.

## [0.3.0] – 2026-10-27 – Phase 3: Katalog, Shop, Warenkorb, Checkout, Bestellungen

### Hinzugefügt
- **Produktverwaltung**: Produkte mit Varianten, SKU/EAN, Einheiten (Stück/Packung/Karton/Palette mit Faktor und eigenem Barcode), Bildern (MinIO), Texten AR/EN, Sichtbarkeit und Mengenregeln pro Kanal; Kategorien; CSV-/Excel-Import mit Vorschau und Export.
- **Katalog & Suche** (AR/EN, SKU, Barcode), Kategorie- und Aktionsfilter, Verfügbarkeitsanzeige; Kanal-DTOs an genau einer Stelle (`server/services/catalog.ts`) – Einkaufs- und B2B-Basispreis werden nie selektiert, Staffeln nur für freigegebene Händler.
- **Warenkorb** ohne gespeicherte Preise (Preise immer serverseitig für den Kanal des Betrachters), Gast-Warenkorb per Cookie, Übernahme beim Login; Angebot in den Warenkorb übernehmen (B2B).
- **Checkout**: Lieferadresse/-gebiet mit Gebühr und Gratis-Grenze, Mindestbestellwert, Liefertage nach Gebiet (Freitag frei, Annahmeschluss 14 Uhr), Zahlungsarten je Kanal, Kreditlimit-Prüfung in der Transaktion (Kundenzeile gesperrt), Lagerreservierung mit `SELECT … FOR UPDATE` – keine Überverkäufe.
- **Bestellungen**: Statusfluss Neu → Bestätigt → Kommissionierung → Bereit → Unterwegs (Lieferschein-Nummer, Warenausgang, Teillieferung mit Rückstand oder Storno) → Zugestellt; fehlgeschlagene Zustellung bucht zurück; Stornierung gibt Reservierungen frei; Bearbeitung nur im Status „Neu“ (manueller Preis mit eigenem Recht und Margenschutz); Statusverlauf; SMS-/WhatsApp-Benachrichtigung über den Log-Adapter.
- **B2B-Extras**: Schnellbestellung (SKU + Menge, auch CSV), „Bestellung wiederholen“, Bestelllisten, Kontoauszug, Dokumente, Angebote im Kundenkonto.
- **Dashboard**: Umsatz und Marge B2B vs. B2C, Artikel unter Mindestbestand, offene Forderungen, Bargeld bei Fahrern.
- **Demo-Bestellungen** in allen Status (`pnpm db:demo-orders`), erzeugt über die echten Services.
- **E2E**: „B2B-Preis nie im HTML/JSON für Gast und B2C“ (inkl. Gegenprobe Händler), B2C-Bestellung mit Nachnahme, B2B-Schnellbestellung auf Rechnung.

### Geändert
- Fehler `OrderStatusError` → HTTP 409 statt 500; Positionswerte werden nach Teillieferung auf die tatsächliche Menge neu berechnet.

## [0.2.0] – 2026-10-26 – Phase 2: Preis-Engine & Preisverwaltung

### Hinzugefügt
- `resolvePrice(product, customer, qty, date, channel)` in `packages/core/src/pricing.ts`: B2B-Kette (Preisliste/Gruppenrabatt → Staffel → Kategorie-Rabatt) im Wettbewerb mit Sonderpreis, Aktion und Angebot; fixe Angebote/Sonderpreise gewinnen; B2C mit Aktion und Rundungsregeln; „Kaufe X, bekomme Y“; vollständige Begründung (Trace) – 50 neue Unit-Tests.
- Mengenregeln (`checkQuantity`), Margenschutz (`minimumPriceNet`, `isBelowMargin`), Massenpreisänderung (`bulkAdjust`).
- Admin-Menü **Preise**: Übersicht mit Marge und Warnung, Gruppen, Preislisten, Staffeln, Sonderpreise, Kategorie-Rabatte, Aktionen, Rundung, geplante Preise, Massenänderung mit Vorschau (sofort oder geplant), CSV-/Excel-Import mit Vorschau und Export, Preis-Historie, Preisvorschau mit Regel-Erklärung.
- Margenschutz: Preise unter Einkauf + Mindestmarge nur mit bewusster Bestätigung (eigenes Recht), protokolliert.
- **Angebote**: Admin erstellt/bearbeitet/versendet, Händler fordert an, nimmt an oder lehnt ab; Ablauf-Job.
- Hintergrundjobs (`instrumentation.ts`): geplante Preise, abgelaufene Angebote.
- Demo-Katalog: 30 Produkte in 6 Kategorien mit Einheiten, Lagerplätzen, Anfangsbestand und Preisregeln.

## [0.1.0] – 2026-10-26 – Phase 1: Grundgerüst

### Hinzugefügt
- **Monorepo** (pnpm + Turborepo): `apps/web`, `packages/core`, `packages/contracts`, `packages/db`, `packages/config`.
- **Docker Compose**: Postgres 16, MinIO, Mailpit, Web (Migration + idempotenter Seed beim Start, Healthcheck).
- **Datenmodell** für alle Phasen (85 Modelle) + Integritäts-Migration: CHECK-Constraints, unveränderliche Rechnungen/Gutschriften, nur-anhängen-Journale, Trigramm-Suchindizes.
- **packages/core**: Agorot-Arithmetik, MwSt. (B2B netto / B2C brutto, Rundung pro Position), Belegnummern (Jahr in Asia/Hebron), Rechte/Rollen, Bestellstatus, Telefonnummern (+970/+972), Preiskanal – 124 Unit-Tests.
- **Lückenlose Nummernvergabe** (`allocateDocumentNumber`) mit Integrationstests (Parallelität, Rollback, Jahreswechsel).
- **Auth**: Telefon-OTP (gehasht, Ablauf, Versuchslimit, Rate-Limit), Mitarbeiter mit Passwort (argon2id) + OTP, DB-Sessions (Cookie für Web, Bearer für Mobile), CSRF-Schutz.
- **Rollen & Rechte**: 6 Systemrollen, 50 Rechte, im Admin frei konfigurierbar; Prüfung in jedem API-Endpunkt und jeder Seite; Schutz vor Entzug des letzten Inhabers.
- **Audit-Log** (wer, was, wann, vorher/nachher; Geheimnisse geschwärzt) in derselben Transaktion wie die Änderung.
- **i18n**: Arabisch (Standard, RTL) und Englisch (LTR), lateinische Ziffern, alle Texte übersetzt (Test auf identische Schlüssel/Platzhalter), Prüfskript gegen physische CSS-Richtungen.
- **Shop**: Startseite, OTP-Login, Registrierung B2C (sofort aktiv) und B2B (Händlernummer, Lizenz-Upload nach MinIO, „wartet auf Freigabe“), Kundenkonto.
- **Admin**: Dashboard (Basiszahlen), Kunden (Liste, Detail, Freigabe mit Gruppe/Zahlungsziel/Kreditlimit, Ablehnung, Sperre, Notizen), Benutzer, Rollen, Einstellungen (Firma, MwSt.-Sätze mit Gültigkeit, Liefergebiete mit Gebühren je Kanal, Zahlungsarten), Audit-Log, gekennzeichnete Platzhalter für spätere Module, Fahrer-Einstieg.
- **Seed**: Firmen-Platzhalter, MwSt. 16 %, Einheiten, 8 Liefergebiete, Zahlungsarten, Auto-Druckregeln, Rollen, Inhaber, Lager, 3 B2B-Gruppen; Demo: 5 Mitarbeiter (je Rolle), 5 Kunden (2 B2C, 3 B2B) – alle als Beispiel markiert; Skript zum Entfernen der Demo-Daten.
- **Betrieb**: Backup-/Restore-Skripte (pg_dump + MinIO-Daten, Prüfsummen, Aufbewahrung), Health-Endpoint, CI-Workflow (Lint, Typecheck, Tests, Build, E2E).
- **E2E (Playwright)**: RTL/LTR, Admin-Login 2-Faktor, falsches Passwort, Fahrer ohne Admin-Rechte, B2C-Registrierung, B2B-Registrierung → Freigabe → B2B-Kanal, OTP-Rate-Limit.
