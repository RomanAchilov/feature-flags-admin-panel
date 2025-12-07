import { afterEach, describe, expect, it, vi } from "vitest";

import { createFlag, type FeatureFlag, fetchFlag, fetchFlags } from "./api";

const mockFlag: FeatureFlag = {
	id: "flag-1",
	key: "flag-1",
	name: "Checkout flow",
	description: null,
	tags: ["beta"],
	type: "BOOLEAN",
	environments: [
		{
			environment: "development",
			enabled: true,
			rolloutPercentage: null,
			forceEnabled: null,
			forceDisabled: null,
			userTargets: [],
			segmentTargets: [],
		},
	],
};

const jsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});

const mockFetch = (response: Response) => {
	const fetchMock = vi.fn().mockResolvedValue(response);
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
};

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("api client", () => {
	it("fetches flags with default headers and parses schema", async () => {
		const fetchMock = mockFetch(jsonResponse({ data: [mockFlag] }));

		const result = await fetchFlags();

		expect(result).toEqual([mockFlag]);
		expect(fetchMock).toHaveBeenCalledWith("/api/flags", {
			headers: expect.objectContaining({ "x-user-id": "admin-panel" }),
		});
	});

	it("surfaces backend errors with provided message", async () => {
		mockFetch(jsonResponse({ error: { message: "Bad request" } }, 400));

		await expect(fetchFlag("missing")).rejects.toThrow("Bad request");
	});

	it("posts payload when creating a flag", async () => {
		const fetchMock = mockFetch(jsonResponse({ data: mockFlag }));

		const created = await createFlag({
			key: "flag-1",
			name: "Checkout flow",
			type: "BOOLEAN",
			tags: [],
			environments: mockFlag.environments,
		});

		expect(created.key).toBe("flag-1");
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/flags",
			expect.objectContaining({
				method: "POST",
				body: expect.stringContaining('"key":"flag-1"'),
			}),
		);
	});
});
