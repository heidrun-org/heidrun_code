import { invoke } from "@tauri-apps/api/core";

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ApplicationLog — writes the load time of a part of the web page in the application log of Heidrun Code
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** A part of the web page whose load time goes to the application log: the Past chats sidebar section, or one tab of the
 * Statistics window. The Tauri command `application_log_load_time` refuses every other name. */
export type ApplicationLogLoadPart = "past_chats" | "statistics_user_activity" | "statistics_git_history" | "statistics_ai_cost";

/** Writes the load times in the application log. */
export class ApplicationLog {
	/**
	 * Writes the line `load_time` of the application log: the time from `startedAt` to now. A failure to write is ignored,
	 * because the application log never stops the application.
	 *
	 * @param part - The part of the web page that loaded its data.
	 * @param startedAt - When the load started, from `performance.now()`.
	 * @param error - The failure of the load, or `null`.
	 * @returns A promise that ends when the line is written, or when the write failed.
	 */
	static async recordLoadTime(part: ApplicationLogLoadPart, startedAt: number, error: string | null): Promise<void> {
		const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
		try {
			await invoke("application_log_load_time", {
				part,
				durationMs,
				error,
			});
		} catch {
			// The application log never stops the application.
		}
	}
}
