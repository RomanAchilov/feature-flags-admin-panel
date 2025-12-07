import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Settings2 } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	collectSegmentTargets,
	collectUserTargets,
	environmentsOrder,
	parseTags,
	type EnvState,
} from "@/lib/flag-utils";
import {
	FeatureFlagTypeSchema,
	fetchFlag,
	type FeatureFlag,
	type UpdateFlagPayload,
	updateFlag,
} from "@/lib/api";
import { EnvironmentCard } from "@/components/EnvironmentCard";

const flagSettingsSchema = z.object({
	name: z.string().min(1, "Укажите имя флага"),
	description: z.string().optional(),
	tagsInput: z.string().optional(),
	type: FeatureFlagTypeSchema,
});

type FlagSettingsForm = z.infer<typeof flagSettingsSchema>;

export const Route = createFileRoute("/flags/$flagKey")({
	component: () => <FlagSettingsPage />,
});

function FlagSettingsPage() {
	const params = Route.useParams();
	const flagKey = params.flagKey;

	const [flag, setFlag] = useState<FeatureFlag | null>(null);
	const [envState, setEnvState] = useState<EnvState[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [info, setInfo] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<FlagSettingsForm>({
		resolver: zodResolver(flagSettingsSchema),
		defaultValues: {
			name: "",
			description: "",
			tagsInput: "",
			type: "BOOLEAN",
		},
	});

	useEffect(() => {
		if (!flagKey) {
			setError("Неверный путь");
			setLoading(false);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setError(null);
		void fetchFlag(flagKey)
			.then((data) => {
				if (cancelled) return;
				setFlag(data);
				setEnvState(buildEnvState(data));
				reset({
					name: data.name,
					description: data.description ?? "",
					tagsInput: data.tags.join(", "),
					type: data.type,
				});
			})
			.catch((err) => {
				if (cancelled) return;
				setError(
					err instanceof Error ? err.message : "Не удалось загрузить флаг",
				);
			})
			.finally(() => {
				if (cancelled) return;
				setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [flagKey, reset]);

	const handleEnvChange = useCallback(
		(environment: EnvState["environment"], changes: Partial<EnvState>) => {
			setEnvState((prev) =>
				prev.map((item) =>
					item.environment === environment ? { ...item, ...changes } : item,
				),
			);
		},
		[],
	);

	const onSave = useCallback(
		async (values: FlagSettingsForm) => {
			if (!flag) return;
			setSaving(true);
			setError(null);
			setInfo(null);

			const payload: UpdateFlagPayload = {
				name: values.name.trim(),
				description: values.description?.trim() || null,
				tags: parseTags(values.tagsInput ?? ""),
				type: values.type,
				environments: envState.map((env) => ({
					environment: env.environment,
					enabled: env.enabled,
					rolloutPercentage: env.rolloutEnabled
						? (env.rolloutPercentage ?? 0)
						: null,
					forceEnabled: null,
					forceDisabled: null,
				})),
				userTargets: collectUserTargets(envState),
				segmentTargets: collectSegmentTargets(envState),
			};

			try {
				const updated = await updateFlag(flag.key, payload);
				setFlag(updated);
				setEnvState(buildEnvState(updated));
				setInfo("Изменения сохранены");
				reset({
					name: updated.name,
					description: updated.description ?? "",
					tagsInput: updated.tags.join(", "),
					type: updated.type,
				});
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Не удалось сохранить изменения",
				);
			} finally {
				setSaving(false);
			}
		},
		[envState, flag, reset],
	);

	const canEdit = Boolean(flag && !loading);

	const nameId = useId();
	const descId = useId();
	const tagsId = useId();
	const typeId = useId();

	return (
		<div className="min-h-screen bg-background text-foreground">
			<div className="mx-auto max-w-6xl px-6 pb-12 pt-8 space-y-6">
				<div className="space-y-2">
					<p className="text-sm uppercase tracking-wide text-muted-foreground">
						Настройки флага
					</p>
					<h1 className="text-3xl font-semibold">
						{flag?.key ?? flagKey ?? "---"}
					</h1>
					<p className="text-sm text-muted-foreground">
						Здесь можно обновить описание, теги и состояние окружений для
						выбранного флага.
					</p>
				</div>

				<div className="flex flex-wrap gap-3">
					<Button variant="outline" size="sm" asChild>
						<Link to="/">← Назад</Link>
					</Button>
					<Button variant="ghost" size="sm" disabled>
						ID {flag?.id ?? "—"}
					</Button>
				</div>

				{error ? (
					<div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive">
						<span>{error}</span>
					</div>
				) : null}
				{info ? (
					<div className="flex items-center gap-3 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-emerald-100">
						<span>{info}</span>
					</div>
				) : null}

				{loading ? (
					<div className="flex items-center justify-center gap-2 rounded-lg border bg-muted/30 px-6 py-8 text-muted-foreground">
						<Loader2 className="h-5 w-5 animate-spin" />
						Загрузка флага...
					</div>
				) : !flag ? (
					<div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-8 text-center text-muted-foreground">
						Флаг не найден.
					</div>
				) : (
					<form
						className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm"
						onSubmit={handleSubmit(onSave)}
					>
						<div className="grid gap-6 md:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor={nameId}>Название</Label>
								<Input
									id={nameId}
									{...register("name")}
									aria-invalid={errors.name ? "true" : "false"}
									disabled={!canEdit}
								/>
								{errors.name ? (
									<p className="text-xs text-destructive">
										{errors.name.message}
									</p>
								) : null}
							</div>
							<div className="space-y-2">
								<Label htmlFor={typeId}>Тип</Label>
								<select
									id={typeId}
									{...register("type")}
									className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
									disabled={!canEdit}
								>
									<option value="BOOLEAN">Boolean</option>
									<option value="MULTIVARIANT">A/B/N</option>
								</select>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor={descId}>Описание</Label>
							<Textarea
								id={descId}
								{...register("description")}
								disabled={!canEdit}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor={tagsId}>Теги</Label>
							<Input
								id={tagsId}
								{...register("tagsInput")}
								placeholder="growth, billing"
								disabled={!canEdit}
							/>
							<p className="text-xs text-muted-foreground">
								Теги помогают быстро искать флаги.
							</p>
						</div>

						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<h2 className="text-lg font-semibold">Окружения</h2>
								<p className="text-xs text-muted-foreground">
									Детальная настройка по средам.
								</p>
							</div>
							<div className="grid gap-4 md:grid-cols-2">
								{envState.map((env) => (
									<EnvironmentCard
										key={env.environment}
										env={env}
										onChange={(changes) =>
											handleEnvChange(env.environment, changes)
										}
									/>
								))}
							</div>
						</div>

						<div className="flex flex-wrap items-center gap-3">
							<Button type="submit" disabled={!canEdit || saving}>
								{saving ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Settings2 className="mr-2 h-4 w-4" />
								)}
								Сохранить изменения
							</Button>
							<Button variant="outline" size="sm" asChild>
								<Link to="/">Отмена</Link>
							</Button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
}

function buildEnvState(flag: FeatureFlag): EnvState[] {
	return environmentsOrder.map((environment) => {
		const found = flag.environments.find(
			(item) => item.environment === environment,
		);
		const includeUsers =
			found?.userTargets
				?.filter((target) => target.include)
				.map((target) => target.userId) ?? [];
		const excludeUsers =
			found?.userTargets
				?.filter((target) => !target.include)
				.map((target) => target.userId) ?? [];

		const includeSegments =
			found?.segmentTargets
				?.filter((target) => target.include)
				.map((target) => target.segment) ?? [];
		const excludeSegments =
			found?.segmentTargets
				?.filter((target) => !target.include)
				.map((target) => target.segment) ?? [];

		const rolloutEnabled = typeof found?.rolloutPercentage === "number";

		return {
			environment,
			enabled: found?.enabled ?? false,
			rolloutPercentage: found?.rolloutPercentage ?? null,
			rolloutEnabled,
			forceEnabled: found?.forceEnabled ?? null,
			forceDisabled: found?.forceDisabled ?? null,
			userTargets: found?.userTargets ?? [],
			segmentTargets: found?.segmentTargets ?? [],
			includeInput: includeUsers.join(", "),
			excludeInput: excludeUsers.join(", "),
			segmentInclude: includeSegments,
			segmentExclude: excludeSegments,
			segmentIncludeDraft: "",
			segmentExcludeDraft: "",
			phoneIncludeDraft: "",
			phoneExcludeDraft: "",
		};
	});
}
