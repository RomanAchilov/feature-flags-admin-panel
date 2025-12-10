import { describe, expect, it } from "vitest";

import {
	collectSegmentTargets,
	deriveBirthdateSegments,
	type EnvState,
	environmentsOrder,
} from "./flag-utils";

const baseEnv: EnvState = {
	environment: environmentsOrder[0],
	enabled: true,
	rolloutPercentage: null,
	rolloutEnabled: false,
	segmentTargets: [],
	segmentInclude: ["employee"],
	segmentExclude: ["beta"],
	phoneIncludeDraft: [{ phone: "+7 999 111 2233", mode: "full" }],
	phoneExcludeDraft: [{ phone: "+7 999 111 0000", mode: "full" }],
	birthdateIncludeDraft: [],
	birthdateExcludeDraft: [],
};

describe("flag-utils", () => {
	it("collectSegmentTargets normalizes segments and phones", () => {
		const targets = collectSegmentTargets([
			{
				...baseEnv,
				segmentInclude: [...baseEnv.segmentInclude, "VIP"],
				segmentExclude: [...baseEnv.segmentExclude, "old_customer", "beta"],
				phoneIncludeDraft: [{ phone: "+7 999 111 2233", mode: "full" }],
				phoneExcludeDraft: [{ phone: "+7 901 000 9900", mode: "full" }],
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
		]);
	});

	describe("deriveBirthdateSegments", () => {
		it("возвращает пустой массив для пустой строки", () => {
			expect(deriveBirthdateSegments("")).toEqual([]);
		});

		it("возвращает пустой массив для невалидной даты", () => {
			expect(deriveBirthdateSegments("not-a-date")).toEqual([]);
			expect(deriveBirthdateSegments("32-13-2024")).toEqual([]);
		});

		it("парсит ISO дату корректно", () => {
			expect(deriveBirthdateSegments("1990-05-15")).toEqual([
				"birthdate:1990-05-15",
			]);
		});

		it("парсит дату из input type=date", () => {
			expect(deriveBirthdateSegments("2000-01-01")).toEqual([
				"birthdate:2000-01-01",
			]);
		});
	});

	it("collectSegmentTargets включает сегменты по дате рождения", () => {
		const targets = collectSegmentTargets([
			{
				...baseEnv,
				segmentInclude: [],
				segmentExclude: [],
				phoneIncludeDraft: [],
				phoneExcludeDraft: [],
				birthdateIncludeDraft: ["1990-05-15"],
				birthdateExcludeDraft: ["2000-01-01"],
			},
		]);
		expect(targets).toEqual([
			{
				environment: environmentsOrder[0],
				segment: "birthdate:1990-05-15",
				include: true,
			},
			{
				environment: environmentsOrder[0],
				segment: "birthdate:2000-01-01",
				include: false,
			},
		]);
	});
});
