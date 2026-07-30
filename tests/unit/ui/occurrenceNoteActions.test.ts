import { resolveOccurrenceNoteTargetDate } from "../../../src/ui/occurrenceNoteActions";
import type { TaskInfo } from "../../../src/types";

function createRecurringTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Weekly task",
		status: "open",
		priority: "normal",
		path: "Tasks/Weekly task.md",
		archived: false,
		recurrence: "DTSTART:20250101;FREQ=WEEKLY",
		scheduled: "2025-01-08",
		...overrides,
	};
}

describe("resolveOccurrenceNoteTargetDate", () => {
	it("resolves to the recurring parent's current scheduled date, ignoring the ambient fallback", () => {
		const parentTask = createRecurringTask({ scheduled: "2025-01-08" });
		const ambientFallback = new Date("2025-01-01T00:00:00Z");

		const result = resolveOccurrenceNoteTargetDate(parentTask, ambientFallback);

		expect(result.toISOString().slice(0, 10)).toBe("2025-01-08");
	});

	it("falls back to the ambient date for a non-recurring task", () => {
		const parentTask = createRecurringTask({ recurrence: undefined });
		const ambientFallback = new Date("2025-01-01T00:00:00Z");

		const result = resolveOccurrenceNoteTargetDate(parentTask, ambientFallback);

		expect(result).toBe(ambientFallback);
	});

	it("falls back to the ambient date when a recurring task has no scheduled date", () => {
		const parentTask = createRecurringTask({ scheduled: undefined });
		const ambientFallback = new Date("2025-01-01T00:00:00Z");

		const result = resolveOccurrenceNoteTargetDate(parentTask, ambientFallback);

		expect(result).toBe(ambientFallback);
	});
});
