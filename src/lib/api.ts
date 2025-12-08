import { z } from "zod";

export const FeatureEnvironmentSchema = z.enum([
	"development",
	"staging",
	"production",
]);
export type FeatureEnvironment = z.infer<typeof FeatureEnvironmentSchema>;

export const FeatureFlagTypeSchema = z.enum(["BOOLEAN", "MULTIVARIANT"]);
export type FeatureFlagType = z.infer<typeof FeatureFlagTypeSchema>;

const UserTargetSchema = z.object({
	userId: z.string().min(1),
	include: z.boolean(),
});

const SegmentTargetSchema = z.object({
	segment: z.string().min(1),
	include: z.boolean(),
});

export const FeatureFlagEnvironmentSchema = z.object({
	environment: FeatureEnvironmentSchema,
	enabled: z.boolean(),
	rolloutPercentage: z.number().min(0).max(100).nullable(),
	forceEnabled: z.boolean().nullable(),
	forceDisabled: z.boolean().nullable(),
	userTargets: z.array(UserTargetSchema).optional().default([]),
	segmentTargets: z.array(SegmentTargetSchema).optional().default([]),
});
export type FeatureFlagEnvironment = z.infer<
	typeof FeatureFlagEnvironmentSchema
>;

export const FeatureFlagSchema = z.object({
	id: z.string(),
	key: z.string(),
	name: z.string(),
	description: z.string().nullable().optional(),
	type: FeatureFlagTypeSchema,
	environments: z.array(FeatureFlagEnvironmentSchema),
});
export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;

export const CreateFlagPayloadSchema = z.object({
	key: z.string().min(1),
	name: z.string().min(1),
	description: z.string().nullable().optional(),
	type: FeatureFlagTypeSchema.default("BOOLEAN"),
	environments: z
		.array(
			FeatureFlagEnvironmentSchema.pick({
				environment: true,
				enabled: true,
				rolloutPercentage: true,
				forceEnabled: true,
				forceDisabled: true,
			}),
		)
		.optional(),
	userTargets: z
		.array(UserTargetSchema.extend({ environment: FeatureEnvironmentSchema }))
		.optional(),
	segmentTargets: z
		.array(
			SegmentTargetSchema.extend({ environment: FeatureEnvironmentSchema }),
		)
		.optional(),
});
export type CreateFlagPayload = z.infer<typeof CreateFlagPayloadSchema>;

export const UpdateFlagPayloadSchema = z.object({
	name: z.string().min(1).optional(),
	description: z.string().nullable().optional(),
	type: FeatureFlagTypeSchema.optional(),
	environments: z
		.array(
			z.object({
				environment: FeatureEnvironmentSchema,
				enabled: z.boolean().optional(),
				rolloutPercentage: z.number().min(0).max(100).nullable().optional(),
				forceEnabled: z.boolean().nullable().optional(),
				forceDisabled: z.boolean().nullable().optional(),
			}),
		)
		.optional(),
	userTargets: z
		.array(UserTargetSchema.extend({ environment: FeatureEnvironmentSchema }))
		.optional(),
	segmentTargets: z
		.array(
			SegmentTargetSchema.extend({ environment: FeatureEnvironmentSchema }),
		)
		.optional(),
});
export type UpdateFlagPayload = z.infer<typeof UpdateFlagPayloadSchema>;

const ApiBaseSchema = z.string().min(1).catch("/api");
const API_BASE = ApiBaseSchema.parse(
	(typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
		"/api",
);

const withBase = (path: string) => `${API_BASE.replace(/\/$/, "")}${path}`;

const defaultHeaders = {
	"Content-Type": "application/json",
	"x-user-id": "admin-panel",
};

const FlagsResponseSchema = z.object({ data: z.array(FeatureFlagSchema) });
const FlagResponseSchema = z.object({ data: FeatureFlagSchema });

const parseJson = async (res: Response) => {
	try {
		return (await res.json()) as unknown;
	} catch {
		return null;
	}
};

async function handleResponse<T>(
	res: Response,
	schema?: z.ZodSchema<T>,
): Promise<T> {
	const json = await parseJson(res);

	if (!res.ok) {
		const message =
			typeof json === "object" && json && "error" in json
				? ((json as { error?: { message?: string } }).error?.message ??
					res.statusText)
				: res.statusText;
		throw new Error(message || "Request failed");
	}

	if (res.status === 204) {
		// @ts-expect-error nothing to return
		return undefined;
	}

	if (schema) {
		if (json === null) {
			throw new Error("Empty response body");
		}
		return schema.parse(json);
	}

	return json as T;
}

export async function fetchFlags(): Promise<FeatureFlag[]> {
	const res = await fetch(withBase("/flags"), {
		headers: defaultHeaders,
	});
	const body = await handleResponse(res, FlagsResponseSchema);
	return body.data ?? [];
}

export async function fetchFlag(key: string): Promise<FeatureFlag> {
	const res = await fetch(withBase(`/flags/${encodeURIComponent(key)}`), {
		headers: defaultHeaders,
	});
	const body = await handleResponse(res, FlagResponseSchema);
	return body.data;
}

export async function createFlag(
	payload: CreateFlagPayload,
): Promise<FeatureFlag> {
	const parsedPayload = CreateFlagPayloadSchema.parse(payload);
	const res = await fetch(withBase("/flags"), {
		method: "POST",
		headers: defaultHeaders,
		body: JSON.stringify(parsedPayload),
	});

	const body = await handleResponse(res, FlagResponseSchema);
	return body.data;
}

export async function updateFlag(
	key: string,
	payload: UpdateFlagPayload,
): Promise<FeatureFlag> {
	const parsedPayload = UpdateFlagPayloadSchema.parse(payload);
	const res = await fetch(withBase(`/flags/${encodeURIComponent(key)}`), {
		method: "PATCH",
		headers: defaultHeaders,
		body: JSON.stringify(parsedPayload),
	});

	const body = await handleResponse(res, FlagResponseSchema);
	return body.data;
}

const ToggleEnvironmentResponseSchema = z.object({
	data: z.object({
		key: z.string(),
		environment: FeatureEnvironmentSchema,
		enabled: z.boolean(),
	}),
});

export async function toggleFlagEnvironment(
	key: string,
	environment: FeatureEnvironment,
	enabled: boolean,
): Promise<FeatureFlag> {
	const res = await fetch(
		withBase(
			`/flags/${encodeURIComponent(key)}/environments/${encodeURIComponent(environment)}`,
		),
		{
			method: "PATCH",
			headers: defaultHeaders,
			body: JSON.stringify({ enabled }),
		},
	);

	await handleResponse(res, ToggleEnvironmentResponseSchema);

	// Fetch the updated flag to keep UI in sync with backend calculations.
	const updatedFlag = await fetchFlag(key);
	return updatedFlag;
}

export async function deleteFlag(key: string): Promise<void> {
	const res = await fetch(withBase(`/flags/${encodeURIComponent(key)}`), {
		method: "DELETE",
		headers: defaultHeaders,
	});

	await handleResponse(res);
}
