import { Notice, TFile } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { formatDateForStorage, getDatePart, parseDateToUTC } from "../utils/dateUtils";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "UI/OccurrenceNoteActions" });

interface OpenTaskPathOptions {
	plugin: TaskNotesPlugin;
	path: string;
	openInNewLeaf?: boolean;
}

interface OpenOrCreateOccurrenceNoteOptions {
	plugin: TaskNotesPlugin;
	parentTask: TaskInfo;
	targetDate: Date;
	openInNewLeaf?: boolean;
	onUpdate?: () => void;
}

interface OpenMaterializedOccurrenceParentOptions {
	plugin: TaskNotesPlugin;
	occurrenceTask: TaskInfo;
	openInNewLeaf?: boolean;
}

export async function openTaskPath(options: OpenTaskPathOptions): Promise<void> {
	const { plugin, path, openInNewLeaf = false } = options;
	const file = plugin.app.vault.getAbstractFileByPath(path);
	if (file instanceof TFile) {
		await plugin.app.workspace.getLeaf(openInNewLeaf).openFile(file);
		return;
	}

	await plugin.app.workspace.openLinkText(path, "", openInNewLeaf);
}

/**
 * Resolves the target date for "open the current occurrence" actions on a recurring
 * parent task. The parent's own `scheduled` field always tracks its current/next
 * occurrence date (for either recurrence_anchor mode), so that's the correct date to
 * look up or materialize - not whatever ambient date a task card happens to be
 * rendered under. Falls back to the ambient date for non-recurring tasks, or recurring
 * tasks with no scheduled date yet.
 *
 * Callers that mean a specific, user-chosen day (e.g. a mini-calendar day click)
 * should keep passing that date directly instead of using this helper.
 */
export function resolveOccurrenceNoteTargetDate(parentTask: TaskInfo, fallbackDate: Date): Date {
	if (parentTask.recurrence && parentTask.scheduled) {
		return parseDateToUTC(getDatePart(parentTask.scheduled));
	}
	return fallbackDate;
}

export async function openOrCreateOccurrenceNote(
	options: OpenOrCreateOccurrenceNoteOptions
): Promise<TaskInfo | null> {
	const { plugin, parentTask, targetDate, openInNewLeaf = false, onUpdate } = options;
	const dateStr = formatDateForStorage(targetDate);

	try {
		const existingOccurrence = await plugin.taskService.findMaterializedOccurrence(
			parentTask,
			targetDate
		);
		const occurrence = await plugin.taskService.materializeOccurrence(parentTask, targetDate);
		await openTaskPath({ plugin, path: occurrence.path, openInNewLeaf });
		onUpdate?.();
		new Notice(
			existingOccurrence
				? `Opened occurrence note for ${dateStr}`
				: `Created occurrence note for ${dateStr}`
		);
		return occurrence;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		tasknotesLogger.error("Error opening or creating occurrence note:", {
			category: "persistence",
			operation: "open-or-create-occurrence-note",
			details: { taskPath: parentTask.path, targetDate: dateStr },
			error: errorMessage,
		});
		new Notice(`Failed to open occurrence note: ${errorMessage}`);
		return null;
	}
}

export async function openMaterializedOccurrenceParent(
	options: OpenMaterializedOccurrenceParentOptions
): Promise<TaskInfo | null> {
	const { plugin, occurrenceTask, openInNewLeaf = false } = options;

	try {
		const parent = await plugin.taskService.getMaterializedOccurrenceParent(occurrenceTask);
		if (!parent) {
			new Notice("Recurring parent not found");
			return null;
		}

		await openTaskPath({ plugin, path: parent.path, openInNewLeaf });
		return parent;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		tasknotesLogger.error("Error opening materialized occurrence parent:", {
			category: "persistence",
			operation: "open-materialized-occurrence-parent",
			details: {
				taskPath: occurrenceTask.path,
				occurrenceDate: occurrenceTask.occurrence_date,
			},
			error: errorMessage,
		});
		new Notice(`Failed to open recurring parent: ${errorMessage}`);
		return null;
	}
}
