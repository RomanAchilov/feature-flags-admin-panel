import type { FeatureEnvironment, FeatureFlagEnvironment } from "@/lib/api";

export const environmentsOrder: FeatureEnvironment[] = [
	"development",
	"staging",
	"production",
];

export type EnvState = FeatureFlagEnvironment & {
	rolloutPercentage: number | null;
	rolloutEnabled: boolean;
	includeInput: string;
	excludeInput: string;
	segmentInclude: string[];
	segmentExclude: string[];
	segmentIncludeDraft: string;
	segmentExcludeDraft: string;
	phoneIncludeDraft: string;
	phoneExcludeDraft: string;
};

export const parseTags = (input: string) =>
	input
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean);

export const collectUserTargets = (envs: EnvState[]) => {
	const targets: {
		environment: FeatureEnvironment;
		userId: string;
		include: boolean;
	}[] = [];

	const splitIds = (input: string) =>
		input
			.split(/[,\\n]/)
			.map((id) => id.trim())
			.filter(Boolean);

	for (const env of envs) {
		for (const id of splitIds(env.includeInput)) {
			targets.push({
				environment: env.environment,
				userId: id,
				include: true,
			});
		}
		for (const id of splitIds(env.excludeInput)) {
			targets.push({
				environment: env.environment,
				userId: id,
				include: false,
			});
		}
	}

	return targets;
};

export const collectSegmentTargets = (envs: EnvState[]) => {
	const targets: {
		environment: FeatureEnvironment;
		segment: string;
		include: boolean;
	}[] = [];

	const normalize = (segments: string[], draft: string) => {
		const withDraft = draft.trim() ? [...segments, draft.trim()] : segments;
		return Array.from(
			new Set(
				withDraft
					.map((segment) => segment.trim())
					.filter(Boolean)
					.map((segment) => segment.toLowerCase()),
			),
		);
	};

	const normalizePhoneSegments = (input: string) => {
		const digits = input.replace(/\D/g, "");
		if (!digits) return [];
		const parts = [`phone:${digits}`];
		if (digits.length >= 4) {
			parts.push(`phone-last4:${digits.slice(-4)}`);
		}
		return parts;
	};

	for (const env of envs) {
		for (const segment of normalize(
			env.segmentInclude,
			env.segmentIncludeDraft,
		)) {
			targets.push({
				environment: env.environment,
				segment,
				include: true,
			});
		}
		for (const segment of normalize(
			env.segmentExclude,
			env.segmentExcludeDraft,
		)) {
			targets.push({
				environment: env.environment,
				segment,
				include: false,
			});
		}

		for (const segment of normalizePhoneSegments(env.phoneIncludeDraft)) {
			targets.push({
				environment: env.environment,
				segment,
				include: true,
			});
		}
		for (const segment of normalizePhoneSegments(env.phoneExcludeDraft)) {
			targets.push({
				environment: env.environment,
				segment,
				include: false,
			});
		}
	}

	return targets;
};

export const addSegment = (segments: string[], value: string) => {
	const normalized = value.trim();
	if (!normalized) return segments;
	const lower = normalized.toLowerCase();
	if (segments.includes(lower)) return segments;
	return [...segments, lower];
};
