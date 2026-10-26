/**
 * Hintergrundjobs im Node-Prozess (ein Container = ein Scheduler):
 *  - geplante Preisänderungen anwenden (alle 5 Minuten)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.DISABLE_JOBS === "1") return;
  const { startJobs } = await import("./server/jobs");
  startJobs();
}
