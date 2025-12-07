import { describe, expect, it } from "vitest";

import {
	collectSegmentTargets,
	collectUserTargets,
	environmentsOrder,
	parseTags,
	type EnvState,
} from "./flag-utils";

const baseEnv: EnvState = {
	environment: environmentsOrder[0],
	enabled: true,
	rolloutPercentage: null,
	rolloutEnabled: false,
	forceEnabled: null,
	forceDisabled: null,
	userTargets: [],
	segmentTargets: [],
	includeInput: "user-a, user-b",
	excludeInput: "blocked",
	segmentInclude: ["employee"],
	segmentExclude: ["beta"],
	segmentIncludeDraft: "vip",
	segmentExcludeDraft: "old_customer",
	phoneIncludeDraft: "+7 999 111 2233",
	phoneExcludeDraft: "+7 999 111 0000",
};

describe("flag-utils", () => {
	it("parseTags splits and trims values", () => {
		expect(parseTags("alpha, beta , gamma")).toEqual([
			"alpha",
			"beta",
			"gamma",
		]);
	});

	it("collectUserTargets returns include and exclude entries", () => {
		const targets = collectUserTargets([baseEnv]);
		expect(targets).toEqual([
			{ environment: environmentsOrder[0], userId: "user-a", include: true },
			{ environment: environmentsOrder[0], userId: "user-b", include: true },
			{ environment: environmentsOrder[0], userId: "blocked", include: false },
		]);
	});

	it("collectSegmentTargets normalizes segments and phones", () => {
		const targets = collectSegmentTargets([baseEnv]);
		expect(targets).toEqual([
			{ environment: environmentsOrder[0], segment: "employee", include: true },
			{ environment: environmentsOrder[0], segment: "vip", include: true },
			{ environment: environmentsOrder[0], segment: "beta", include: false },
			{
				environment: environmentsOrder[0],
				segment: "old_customer",
				include: false,
			},
			{
				environment: environmentsOrder[0],
				segment: "phone:79991112233",
				include: true,
			},
			{
				environment: environmentsOrder[0],
				segment: "phone-last4:2233",
				include: true,
			},
			{
				environment: environmentsOrder[0],
				segment: "phone:79991110000",
				include: false,
			},
			{
				environment: environmentsOrder[0],
				segment: "phone-last4:0000",
				include: false,
			},
		]);
	});
});
