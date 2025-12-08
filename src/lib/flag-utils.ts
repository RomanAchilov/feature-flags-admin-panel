import type { FeatureEnvironment, FeatureFlagEnvironment } from "@/lib/api";

export const environmentsOrder: FeatureEnvironment[] = [
	"development",
	"staging",
	"production",
];

export type EnvState = FeatureFlagEnvironment & {
	rolloutPercentage: number | null;
	rolloutEnabled: boolean;
	segmentInclude: string[];
	segmentExclude: string[];
	phoneIncludeDraft: string;
	phoneExcludeDraft: string;
};

export const derivePhoneSegments = (input: string) => {
	const digits = input.replace(/\D/g, "");
	if (!digits) return [];
	const parts = [`phone:${digits}`];
	if (digits.length >= 2) {
		parts.push(`phone-last2:${digits.slice(-2)}`);
	}
	if (digits.length >= 3) {
		const prefix =
			digits.startsWith("7") && digits.length >= 4
				? digits.slice(1, 4)
				: digits.slice(0, 3);
		if (prefix.length === 3) {
			parts.push(`phone-prefix3:${prefix}`);
		}
	}
	if (digits.length >= 4) {
		parts.push(`phone-last4:${digits.slice(-4)}`);
	}
	return Array.from(new Set(parts));
};

export const collectSegmentTargets = (envs: EnvState[]) => {
	const targets: {
		environment: FeatureEnvironment;
		segment: string;
		include: boolean;
	}[] = [];

	const normalize = (segments: string[]) =>
		Array.from(
			new Set(
				segments
					.map((segment) => segment.trim())
					.filter(Boolean)
					.map((segment) => segment.toLowerCase()),
			),
		);

	for (const env of envs) {
		const includeSegments = new Set([
			...normalize(env.segmentInclude),
			...derivePhoneSegments(env.phoneIncludeDraft),
		]);
		const excludeSegments = new Set([
			...normalize(env.segmentExclude),
			...derivePhoneSegments(env.phoneExcludeDraft),
		]);

		for (const segment of includeSegments) {
			if (excludeSegments.has(segment)) continue;
			targets.push({
				environment: env.environment,
				segment,
				include: true,
			});
		}
		for (const segment of excludeSegments) {
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
