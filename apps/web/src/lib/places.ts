/** Vorschläge für die freie Ortseingabe – keine abschließende Liste */
export const PLACE_SUGGESTIONS: { ar: string; en: string }[] = [
  ["الخليل", "Hebron"], ["دورا", "Dura"], ["يطا", "Yatta"], ["حلحول", "Halhul"], ["بني نعيم", "Bani Na'im"], ["سعير", "Sa'ir"],
  ["الظاهرية", "Adh-Dhahiriya"], ["بيت أمر", "Beit Ummar"], ["ترقوميا", "Tarqumiya"], ["إذنا", "Idhna"], ["الشيوخ", "Ash-Shuyukh"], ["السموع", "As-Samu"],
  ["بيت لحم", "Bethlehem"], ["بيت جالا", "Beit Jala"], ["بيت ساحور", "Beit Sahour"], ["الخضر", "Al-Khader"], ["تقوع", "Tuqu'"],
  ["رام الله", "Ramallah"], ["البيرة", "Al-Bireh"], ["بيرزيت", "Birzeit"], ["سلواد", "Silwad"],
  ["القدس", "Jerusalem"], ["العيزرية", "Al-Eizariya"], ["أبو ديس", "Abu Dis"],
  ["نابلس", "Nablus"], ["جنين", "Jenin"], ["طولكرم", "Tulkarm"], ["قلقيلية", "Qalqilya"], ["سلفيت", "Salfit"], ["طوباس", "Tubas"], ["أريحا", "Jericho"],
].map(([ar, en]) => ({ ar: ar!, en: en! }));
