import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Settings2 } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { EnvironmentCard } from "@/components/EnvironmentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	createSegment,
	type FeatureFlag,
	FeatureFlagTypeSchema,
	fetchFlag,
	fetchSegments,
	type UpdateFlagPayload,
	updateFlag,
} from "@/lib/api";
import {
	collectSegmentTargets,
	type EnvState,
	environmentsOrder,
} from "@/lib/flag-utils";

const flagSettingsSchema = z.object({
	name: z.string().min(1, "Укажите имя флага"),
	description: z.string().optional(),
	type: FeatureFlagTypeSchema,
});

type FlagSettingsForm = z.infer<typeof flagSettingsSchema>;

export const Route = createFileRoute("/flags/$flagKey")({
	component: () => <FlagSettingsPage />,
});

function mergeSegments(current: string[], incoming: string[]) {
	const next = new Set(
		[...current, ...incoming]
			.map((segment) => segment.trim().toLowerCase())
			.filter(Boolean),
	);
	return Array.from(next);
}

function collectSegmentsFromState(envs: EnvState[]) {
	return Array.from(
		new Set(
			envs.flatMap((env) => [...env.segmentInclude, ...env.segmentExclude]),
		),
	);
}

function FlagSettingsPage() {
	const params = Route.useParams();
	const flagKey = params.flagKey;

	const [flag, setFlag] = useState<FeatureFlag | null>(null);
	const [envState, setEnvState] = useState<EnvState[]>([]);
	const [activeEnvironment, setActiveEnvironment] = useState<
		EnvState["environment"] | null
	>(null);
	const [availableSegments, setAvailableSegments] = useState<string[]>([]);
	const [segmentsLoading, setSegmentsLoading] = useState(false);
	const [segmentsError, setSegmentsError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		reset,
		control,
		formState: { errors },
	} = useForm<FlagSettingsForm>({
		resolver: zodResolver(flagSettingsSchema),
		defaultValues: {
			name: "",
			description: "",
			type: "BOOLEAN",
		},
	});

	const envSelectId = useId();
	const nameId = useId();
	const descId = useId();
	const typeId = useId();

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
				const builtState = buildEnvState(data);
				setEnvState(builtState);
				setActiveEnvironment(
					(prev) => prev ?? builtState[0]?.environment ?? environmentsOrder[0],
				);
				setAvailableSegments((prev) =>
					mergeSegments(prev, collectSegmentsFromState(builtState)),
				);
				reset({
					name: data.name,
					description: data.description ?? "",
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

	useEffect(() => {
		let cancelled = false;
		setSegmentsLoading(true);
		setSegmentsError(null);
		void fetchSegments()
			.then((segments) => {
				if (cancelled) return;
				setAvailableSegments((prev) => mergeSegments(prev, segments));
			})
			.catch((err) => {
				if (cancelled) return;
				setSegmentsError(
					err instanceof Error ? err.message : "Не удалось загрузить сегменты",
				);
			})
			.finally(() => {
				if (cancelled) return;
				setSegmentsLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		setAvailableSegments((prev) =>
			mergeSegments(prev, collectSegmentsFromState(envState)),
		);
	}, [envState]);

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

	const handleCreateSegment = useCallback(async (name: string) => {
		try {
			const created = await createSegment(name);
			setSegmentsError(null);
			setAvailableSegments((prev) => mergeSegments(prev, [created]));
			return created;
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Не удалось создать сегмент";
			setSegmentsError(message);
			throw new Error(message);
		}
	}, []);

	const onSave = useCallback(
		async (values: FlagSettingsForm) => {
			if (!flag) return;
			setSaving(true);
			setError(null);

			const payload: UpdateFlagPayload = {
				name: values.name.trim(),
				description: values.description?.trim() || null,
				type: values.type,
				environments: envState.map((env) => ({
					environment: env.environment,
					enabled: env.enabled,
					rolloutPercentage: env.rolloutEnabled
						? (env.rolloutPercentage ?? 0)
						: null,
				})),
				segmentTargets: collectSegmentTargets(envState),
			};

			try {
				const updated = await updateFlag(flag.key, payload);
				setFlag(updated);
				const builtState = buildEnvState(updated);
				setEnvState(builtState);
				setAvailableSegments((prev) =>
					mergeSegments(prev, collectSegmentsFromState(builtState)),
				);
				toast.success("Изменения сохранены", {
					description: `Флаг "${updated.name}" успешно обновлён`,
				});
				reset({
					name: updated.name,
					description: updated.description ?? "",
					type: updated.type,
				});
			} catch (err) {
				const message =
					err instanceof Error ? err.message : "Не удалось сохранить изменения";
				toast.error("Ошибка сохранения", {
					description: message,
				});
				setError(message);
			} finally {
				setSaving(false);
			}
		},
		[envState, flag, reset],
	);

	const canEdit = Boolean(flag && !loading);

	const currentEnv = useMemo(
		() =>
			envState.find((item) => item.environment === activeEnvironment) ??
			envState[0],
		[activeEnvironment, envState],
	);

	return (
		<div className="min-h-screen bg-background text-foreground">
			<div className="mx-auto max-w-6xl space-y-6 px-6 pb-12 pt-8">
				<div className="space-y-2">
					<p className="text-sm uppercase tracking-wide text-muted-foreground">
						Настройки флага
					</p>
					<h1 className="text-3xl font-semibold">
						{flag?.key ?? flagKey ?? "---"}
					</h1>
					<p className="text-sm text-muted-foreground">
						Здесь можно обновить описание и состояние окружений для выбранного
						флага.
					</p>
				</div>

				<div className="flex flex-wrap gap-3">
					<Button variant="outline" size="sm" asChild>
						<Link to="/">
							<ArrowLeft className="h-4 w-4" />
							Назад
						</Link>
					</Button>
					<Button variant="ghost" size="sm" disabled>
						ID {flag?.id ?? "-"}
					</Button>
				</div>

				{error ? (
					<div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive">
						<span>{error}</span>
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
								<Controller
									name="type"
									control={control}
									render={({ field }) => (
										<Select
											value={field.value}
											onValueChange={field.onChange}
											disabled={!canEdit}
										>
											<SelectTrigger id={typeId} className="w-full">
												<SelectValue placeholder="Выберите тип" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="BOOLEAN">Boolean</SelectItem>
												<SelectItem value="MULTIVARIANT">A/B/N</SelectItem>
											</SelectContent>
										</Select>
									)}
								/>
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

						<div className="space-y-3">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<h2 className="text-lg font-semibold">Окружения</h2>
									<p className="text-xs text-muted-foreground">
										Настраивайте одно окружение за раз через селект.
									</p>
								</div>
								<div className="flex items-center gap-2">
									<Label
										htmlFor={envSelectId}
										className="text-xs text-muted-foreground"
									>
										Окружение
									</Label>
									<Select
										value={currentEnv?.environment ?? ""}
										onValueChange={(value) =>
											setActiveEnvironment(value as EnvState["environment"])
										}
									>
										<SelectTrigger
											id={envSelectId}
											className="min-w-[140px]"
											disabled={!canEdit}
										>
											<SelectValue placeholder="Выберите среду" />
										</SelectTrigger>
										<SelectContent>
											{environmentsOrder.map((env) => (
												<SelectItem key={env} value={env}>
													{env}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
							{segmentsLoading ? (
								<p className="text-xs text-muted-foreground">
									Загружаем доступные сегменты...
								</p>
							) : null}
							{segmentsError ? (
								<p className="text-xs text-destructive">{segmentsError}</p>
							) : null}
							{currentEnv ? (
								<EnvironmentCard
									env={currentEnv}
									availableSegments={availableSegments}
									onChange={(changes) =>
										handleEnvChange(currentEnv.environment, changes)
									}
									onCreateSegment={handleCreateSegment}
								/>
							) : (
								<div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
									Окружение не выбрано.
								</div>
							)}
						</div>

						<div className="flex flex-wrap items-center gap-3">
							<Button type="submit" disabled={!canEdit || saving}>
								{saving ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
			segmentTargets: found?.segmentTargets ?? [],
			segmentInclude: includeSegments,
			segmentExclude: excludeSegments,
			phoneIncludeDraft: "",
			phoneExcludeDraft: "",
			phoneIncludeMode: "auto",
			phoneExcludeMode: "auto",
			birthdateIncludeDraft: "",
			birthdateExcludeDraft: "",
		};
	});
}
