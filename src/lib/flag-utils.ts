import type { FeatureEnvironment, FeatureFlagEnvironment } from "@/lib/api";

export const environmentsOrder: FeatureEnvironment[] = [
	"development",
	"staging",
	"production",
];

export type PhoneMatchMode = "full" | "last2" | "last4" | "prefix3" | "auto";

export const phoneMatchModeLabels: Record<PhoneMatchMode, string> = {
	auto: "Авто (все режимы)",
	full: "Полный номер",
	last2: "Последние 2 цифры",
	last4: "Последние 4 цифры",
	prefix3: "Код оператора (3 цифры)",
};

export type EnvState = FeatureFlagEnvironment & {
	rolloutPercentage: number | null;
	rolloutEnabled: boolean;
	segmentInclude: string[];
	segmentExclude: string[];
	phoneIncludeDraft: string;
	phoneExcludeDraft: string;
	phoneIncludeMode: PhoneMatchMode;
	phoneExcludeMode: PhoneMatchMode;
};

export const derivePhoneSegments = (
	input: string,
	mode: PhoneMatchMode = "auto",
) => {
	const digits = input.replace(/\D/g, "");
	if (!digits) return [];

	const parts: string[] = [];

	// Полный номер
	if (mode === "auto" || mode === "full") {
		parts.push(`phone:${digits}`);
	}

	// Последние 2 цифры
	if ((mode === "auto" || mode === "last2") && digits.length >= 2) {
		parts.push(`phone-last2:${digits.slice(-2)}`);
	}

	// Код оператора (первые 3 цифры после кода страны)
	if ((mode === "auto" || mode === "prefix3") && digits.length >= 3) {
		const prefix =
			digits.startsWith("7") && digits.length >= 4
				? digits.slice(1, 4)
				: digits.slice(0, 3);
		if (prefix.length === 3) {
			parts.push(`phone-prefix3:${prefix}`);
		}
	}

	// Последние 4 цифры
	if ((mode === "auto" || mode === "last4") && digits.length >= 4) {
		parts.push(`phone-last4:${digits.slice(-4)}`);
	}

	return Array.from(new Set(parts));
};

export const getSegmentDescription = (segment: string): string => {
	if (segment.startsWith("phone:")) {
		return `Полный номер: ${segment.replace("phone:", "")}`;
	}
	if (segment.startsWith("phone-last2:")) {
		return `Последние 2: **${segment.replace("phone-last2:", "")}`;
	}
	if (segment.startsWith("phone-last4:")) {
		return `Последние 4: **${segment.replace("phone-last4:", "")}`;
	}
	if (segment.startsWith("phone-prefix3:")) {
		return `Код: ${segment.replace("phone-prefix3:", "")}***`;
	}
	return segment;
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
			...derivePhoneSegments(env.phoneIncludeDraft, env.phoneIncludeMode),
		]);
		const excludeSegments = new Set([
			...normalize(env.segmentExclude),
			...derivePhoneSegments(env.phoneExcludeDraft, env.phoneExcludeMode),
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
