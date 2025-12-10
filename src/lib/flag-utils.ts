import type { FeatureEnvironment, FeatureFlagEnvironment } from "@/lib/api";

export const environmentsOrder: FeatureEnvironment[] = [
	"development",
	"staging",
	"production",
];

export type PhoneMatchMode = "full" | "last2" | "prefix3";

export const phoneMatchModeLabels: Record<PhoneMatchMode, string> = {
	full: "Полный номер",
	last2: "Последние 2 цифры",
	prefix3: "Код оператора (3 цифры)",
};

export type PhoneTarget = {
	phone: string;
	mode: PhoneMatchMode;
};

export type EnvState = FeatureFlagEnvironment & {
	rolloutPercentage: number | null;
	rolloutEnabled: boolean;
	segmentInclude: string[];
	segmentExclude: string[];
	phoneIncludeDraft: PhoneTarget[];
	phoneExcludeDraft: PhoneTarget[];
	birthdateIncludeDraft: string[];
	birthdateExcludeDraft: string[];
};

export const derivePhoneSegments = (
	input: string,
	mode: PhoneMatchMode = "full",
) => {
	const digits = input.replace(/\D/g, "");
	if (!digits) return [];

	const parts: string[] = [];

	// Полный номер
	if (mode === "full") {
		parts.push(`phone:${digits}`);
	}

	// Последние 2 цифры
	if (mode === "last2" && digits.length >= 2) {
		parts.push(`phone-last2:${digits.slice(-2)}`);
	}

	// Код оператора (первые 3 цифры после кода страны)
	if (mode === "prefix3" && digits.length >= 3) {
		const prefix =
			digits.startsWith("7") && digits.length >= 4
				? digits.slice(1, 4)
				: digits.slice(0, 3);
		if (prefix.length === 3) {
			parts.push(`phone-prefix3:${prefix}`);
		}
	}

	return Array.from(new Set(parts));
};

/**
 * Парсит дату в формате ДД.ММ.ГГГГ и возвращает ISO строку YYYY-MM-DD
 */
export const parseRuDate = (input: string): string | null => {
	if (!input) return null;

	// Формат ДД.ММ.ГГГГ
	const match = input.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
	if (match) {
		const [, day, month, year] = match;
		const isoDate = `${year}-${month}-${day}`;
		const parsed = new Date(isoDate);
		if (!Number.isNaN(parsed.getTime())) {
			return isoDate;
		}
	}

	// Fallback: пробуем стандартный формат ISO (YYYY-MM-DD)
	const parsed = new Date(input);
	if (!Number.isNaN(parsed.getTime())) {
		return parsed.toISOString().slice(0, 10);
	}

	return null;
};

/**
 * Форматирует ISO дату (YYYY-MM-DD) в русский формат ДД.ММ.ГГГГ
 */
export const formatToRuDate = (isoDate: string): string => {
	if (!isoDate) return "";
	const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (match) {
		const [, year, month, day] = match;
		return `${day}.${month}.${year}`;
	}
	return isoDate;
};

export const deriveBirthdateSegments = (input: string): string[] => {
	const isoDate = parseRuDate(input);
	if (!isoDate) return [];

	return [`birthdate:${isoDate}`];
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
	if (segment.startsWith("birthdate:")) {
		const date = segment.replace("birthdate:", "");
		return `Дата рождения: ${date}`;
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
		const phoneIncludeSegments = env.phoneIncludeDraft.flatMap((target) =>
			derivePhoneSegments(target.phone, target.mode),
		);
		const phoneExcludeSegments = env.phoneExcludeDraft.flatMap((target) =>
			derivePhoneSegments(target.phone, target.mode),
		);
		const birthdateIncludeSegments = env.birthdateIncludeDraft.flatMap(
			(birthdate) => deriveBirthdateSegments(birthdate),
		);
		const birthdateExcludeSegments = env.birthdateExcludeDraft.flatMap(
			(birthdate) => deriveBirthdateSegments(birthdate),
		);

		const includeSegments = new Set([
			...normalize(env.segmentInclude),
			...phoneIncludeSegments,
			...birthdateIncludeSegments,
		]);
		const excludeSegments = new Set([
			...normalize(env.segmentExclude),
			...phoneExcludeSegments,
			...birthdateExcludeSegments,
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
