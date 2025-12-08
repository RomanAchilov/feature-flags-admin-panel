import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeatureFlagsDashboard } from "@/routes/index";

const apiMocks = vi.hoisted(() => ({
	fetchFlags: vi.fn(),
	updateFlag: vi.fn(),
	deleteFlag: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
		"@tanstack/react-router",
	);
	return {
		...actual,
		Link: ({ children, ...props }: { children: ReactNode }) => (
			<a {...props}>{children}</a>
		),
	};
});

vi.mock("@/lib/api", () => apiMocks);

const baseFlag = {
	id: "flag-1",
	key: "critical-flag",
	name: "Critical flag",
	description: "Protect production changes",
	tags: ["prod"],
	type: "BOOLEAN" as const,
	environments: [
		{
			environment: "development" as const,
			enabled: true,
			rolloutPercentage: null,
			forceEnabled: null,
			forceDisabled: null,
			userTargets: [],
			segmentTargets: [],
		},
		{
			environment: "staging" as const,
			enabled: false,
			rolloutPercentage: null,
			forceEnabled: null,
			forceDisabled: null,
			userTargets: [],
			segmentTargets: [],
		},
		{
			environment: "production" as const,
			enabled: false,
			rolloutPercentage: null,
			forceEnabled: null,
			forceDisabled: null,
			userTargets: [],
			segmentTargets: [],
		},
	],
};

describe("FeatureFlagsDashboard confirmations", () => {
	beforeEach(() => {
		apiMocks.fetchFlags.mockReset();
		apiMocks.updateFlag.mockReset();
		apiMocks.deleteFlag.mockReset();

		apiMocks.fetchFlags.mockResolvedValue([baseFlag]);
		apiMocks.updateFlag.mockResolvedValue(baseFlag);
		apiMocks.deleteFlag.mockResolvedValue(undefined);
	});

	const renderDashboard = async () => {
		render(<FeatureFlagsDashboard />);
		await waitFor(() => expect(apiMocks.fetchFlags).toHaveBeenCalled());
		const titles = await screen.findAllByText(baseFlag.key);
		expect(titles.length).toBeGreaterThan(0);
	};

	it("requires typing the flag key before toggling production", async () => {
		await renderDashboard();

		const productionSwitch = await screen.findByLabelText(
			`Переключатель production для ${baseFlag.key}`,
		);
		fireEvent.click(productionSwitch);

		await screen.findByText("Включить production");
		const dialog = await screen.findByRole("alertdialog");
		const confirmButton = within(dialog).getByRole("button", {
			name: "Включить",
		});
		expect((confirmButton as HTMLButtonElement).disabled).toBe(true);

		const input = within(dialog).getByPlaceholderText("Введите ключ флага");
		fireEvent.change(input, { target: { value: "wrong-key" } });
		expect((confirmButton as HTMLButtonElement).disabled).toBe(true);

		fireEvent.change(input, { target: { value: baseFlag.key } });
		expect((confirmButton as HTMLButtonElement).disabled).toBe(false);

		fireEvent.click(confirmButton);

		await waitFor(() =>
			expect(apiMocks.updateFlag).toHaveBeenCalledWith(baseFlag.key, {
				environments: [{ environment: "production", enabled: true }],
			}),
		);
		expect(screen.queryByText("Включить production")).toBeNull();
	});

	it("requires typing the flag key before deleting", async () => {
		await renderDashboard();

		const [deleteButton] = screen.getAllByRole("button", { name: "Удалить" });
		fireEvent.click(deleteButton);

		await screen.findByText("Удалить флаг?");
		const dialog = await screen.findByRole("alertdialog");
		const confirmButton = within(dialog).getByRole("button", {
			name: "Удалить",
		});
		expect((confirmButton as HTMLButtonElement).disabled).toBe(true);

		const input = within(dialog).getByPlaceholderText("Введите ключ флага");
		fireEvent.change(input, { target: { value: baseFlag.key } });
		expect((confirmButton as HTMLButtonElement).disabled).toBe(false);

		fireEvent.click(confirmButton);

		await waitFor(() =>
			expect(apiMocks.deleteFlag).toHaveBeenCalledWith(baseFlag.key),
		);
		expect(screen.queryByText("Удалить флаг?")).toBeNull();
	});
});
