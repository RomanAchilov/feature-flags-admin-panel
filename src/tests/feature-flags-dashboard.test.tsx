import {
        fireEvent,
        render,
        screen,
        waitFor,
        within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import { useDashboardActionsStore } from "@/stores/dashboard-actions";

const apiMocks = vi.hoisted(() => ({
	fetchFlags: vi.fn(),
	toggleFlagEnvironment: vi.fn(),
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

vi.mock("@/lib/api", async () => {
        const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
        return { ...actual, ...apiMocks };
});

function createTestRouter(initialEntry = "/") {
        return createRouter({
                routeTree,
                context: {},
                history: createMemoryHistory({ initialEntries: [initialEntry] }),
                defaultPreload: "intent",
                scrollRestoration: true,
                defaultStructuralSharing: true,
                defaultPreloadStaleTime: 0,
        });
}

const baseFlag = {
        id: "flag-1",
        key: "critical-flag",
	name: "Critical flag",
	description: "Protect production changes",
	type: "BOOLEAN" as const,
	environments: [
		{
			environment: "development" as const,
			enabled: true,
			rolloutPercentage: null,
			segmentTargets: [],
		},
		{
			environment: "staging" as const,
			enabled: false,
			rolloutPercentage: null,
			segmentTargets: [],
		},
		{
			environment: "production" as const,
			enabled: false,
			rolloutPercentage: null,
			segmentTargets: [],
		},
	],
};

describe("FeatureFlagsDashboard confirmations", () => {
	beforeEach(() => {
        apiMocks.fetchFlags.mockReset();
        apiMocks.toggleFlagEnvironment.mockReset();
        apiMocks.deleteFlag.mockReset();

        useDashboardActionsStore.getState().resetAll();

        apiMocks.fetchFlags.mockResolvedValue([baseFlag]);
        apiMocks.toggleFlagEnvironment.mockResolvedValue(baseFlag);
        apiMocks.deleteFlag.mockResolvedValue(undefined);
	});

        const renderDashboard = async (initialEntry = "/") => {
                const router = createTestRouter(initialEntry);
                render(<RouterProvider router={router} />);
                await waitFor(() => expect(apiMocks.fetchFlags).toHaveBeenCalled());
                const titles = await screen.findAllByText(baseFlag.key);
                expect(titles.length).toBeGreaterThan(0);
                return router;
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
			expect(apiMocks.toggleFlagEnvironment).toHaveBeenCalledWith(
				baseFlag.key,
				"production",
				true,
			),
		);
		expect(screen.queryByText("Включить production")).toBeNull();
	});

        it("requires typing the flag key before deleting", async () => {
                await renderDashboard();

                const [deleteButton] = screen.getAllByRole("button", { name: "Удалить" });
                fireEvent.click(deleteButton);

                const [dialog] = await screen.findAllByRole("alertdialog");
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

        it("syncs search input with url state", async () => {
                const router = await renderDashboard("/?query=critical");

                const searchInputs = await screen.findAllByPlaceholderText(
                        "Поиск по ключу или имени",
                );
                const searchInput =
                        searchInputs.find(
                                (input) => (input as HTMLInputElement).value === "critical",
                        ) ?? searchInputs[0];

                expect((searchInput as HTMLInputElement).value).toBe("critical");

                fireEvent.change(searchInput, { target: { value: "rollout" } });

                await waitFor(() =>
                        expect(
                                (router.state.location.search as { query?: string }).query,
                        ).toBe("rollout"),
                );
        });
});
