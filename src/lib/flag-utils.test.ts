import { describe, expect, it } from "vitest";

import {
	collectSegmentTargets,
	type EnvState,
	environmentsOrder,
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
	segmentInclude: ["employee"],
	segmentExclude: ["beta"],
	phoneIncludeDraft: "+7 999 111 2233",
	phoneExcludeDraft: "+7 999 111 0000",
};

describe("flag-utils", () => {
	it("collectSegmentTargets normalizes segments and phones", () => {
		const targets = collectSegmentTargets([
			{
				...baseEnv,
				segmentInclude: [...baseEnv.segmentInclude, "VIP"],
				segmentExclude: [...baseEnv.segmentExclude, "old_customer", "beta"],
				phoneIncludeDraft: "+7 999 111 2233",
				phoneExcludeDraft: "+7 901 000 9900",
			},
		]);
		expect(targets).toEqual([
			{ environment: environmentsOrder[0], segment: "employee", include: true },
			{ environment: environmentsOrder[0], segment: "vip", include: true },
			{
				environment: environmentsOrder[0],
				segment: "phone:79991112233",
				include: true,
			},
			{
				environment: environmentsOrder[0],
				segment: "phone-last2:33",
				include: true,
			},
			{
				environment: environmentsOrder[0],
				segment: "phone-prefix3:999",
				include: true,
			},
			{
				environment: environmentsOrder[0],
				segment: "phone-last4:2233",
				include: true,
			},
			{ environment: environmentsOrder[0], segment: "beta", include: false },
			{
				environment: environmentsOrder[0],
				segment: "old_customer",
				include: false,
			},
			{
				environment: environmentsOrder[0],
				segment: "phone:79010009900",
				include: false,
			},
			{
				environment: environmentsOrder[0],
				segment: "phone-last2:00",
				include: false,
			},
			{
				environment: environmentsOrder[0],
				segment: "phone-prefix3:901",
				include: false,
			},
			{
				environment: environmentsOrder[0],
				segment: "phone-last4:9900",
				include: false,
			},
		]);
	});
});
