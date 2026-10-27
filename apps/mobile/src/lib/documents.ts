import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { API_URL } from "./api";

/** A4-PDF mit Bearer-Token laden und mit der System-Vorschau öffnen/teilen */
export async function openDocument(path: string, token: string | null, filename: string, locale: string) {
  const target = new File(Paths.cache, filename.replace(/[^\w.-]/g, "_"));
  if (target.exists) target.delete();
  const file = await File.downloadFileAsync(`${API_URL}${path}${path.includes("?") ? "&" : "?"}lang=${locale}`, target, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
}
