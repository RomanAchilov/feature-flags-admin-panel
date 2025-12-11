import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Settings2 } from "lucide-react";
import { useCallback, useId, useMemo, useState } from "react";
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
	name: z.string().min(1, "Название обязательно"),
	description: z.string().optional(),
	type: FeatureFlagTypeSchema,
});

type FlagSettingsForm = z.infer<typeof flagSettingsSchema>;

type FlagSettingsLoader = {
	flag: FeatureFlag;
	segments: string[];
};

export const Route = createFileRoute("/flags/$flagKey")({
	loader: async ({ params }): Promise<FlagSettingsLoader> => {
		const flagKey = params.flagKey;
		if (!flagKey) {
			throw new Error("Ключ флага не указан");
		}
		const [flag, segments] = await Promise.all([
			fetchFlag(flagKey),
			fetchSegments(),
		]);
		return { flag, segments };
	},
	component: () => <FlagSettingsPage />,
	errorComponent: ({ error }) => (
		<div className="min-h-screen bg-background text-foreground">
			<div className="mx-auto max-w-4xl space-y-4 px-6 py-12">
				<div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive">
					{error instanceof Error
						? error.message
						: "Не удалось загрузить данные флага"}
				</div>
				<Button asChild variant="outline" size="sm">
					<Link to="/">
						<ArrowLeft className="mr-2 h-4 w-4" />
						Назад
					</Link>
				</Button>
			</div>
		</div>
	),
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

export function FlagSettingsPage() {
	const loaderData = Route.useLoaderData();
	return (
		<FlagSettingsContent
			key={loaderData.flag.key}
			flag={loaderData.flag}
			initialSegments={loaderData.segments}
		/>
	);
}

type FlagSettingsContentProps = {
	flag: FeatureFlag;
	initialSegments: string[];
};

function FlagSettingsContent({
	flag,
	initialSegments,
}: FlagSettingsContentProps) {
        const [envState, setEnvState] = useState<EnvState[]>(() =>
                buildEnvState(flag),
        );
        const [activeEnvironment, setActiveEnvironment] = useState<
                EnvState["environment"] | null
        >(() => buildEnvState(flag)[0]?.environment ?? environmentsOrder[0]);
        const [segments, setSegments] = useState<string[]>(() => initialSegments);

        const {
                register,
                handleSubmit,
                reset,
                control,
                setError,
                clearErrors,
                formState: { errors, isSubmitting },
        } = useForm<FlagSettingsForm>({
                resolver: zodResolver(flagSettingsSchema),
                defaultValues: {
			name: flag.name,
			description: flag.description ?? "",
			type: flag.type,
		},
	});

	const envSelectId = useId();
	const nameId = useId();
	const descId = useId();
	const typeId = useId();

	const availableSegments = useMemo(
		() => mergeSegments(segments, collectSegmentsFromState(envState)),
		[envState, segments],
	);

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
                        clearErrors("root");
                        setSegments((prev) => mergeSegments(prev, [created]));
                        return created;
                } catch (err) {
                        const message =
                                err instanceof Error ? err.message : "Не удалось создать сегмент";
                        setError("root", { type: "segments", message, types: { segments: message } });
                        throw new Error(message);
                }
        }, [clearErrors, setError]);

        const onSave = useCallback(
                async (values: FlagSettingsForm) => {
                        clearErrors("root");

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
				const builtState = buildEnvState(updated);
				setEnvState(builtState);
				setSegments((prev) =>
					mergeSegments(prev, collectSegmentsFromState(builtState)),
				);
                        toast.success("Настройки флага сохранены", {
                                description: `Флаг "${updated.name}" успешно обновлён`,
                        });
                        reset({
                                name: updated.name,
                                description: updated.description ?? "",
                                type: updated.type,
                        });
                } catch (err) {
                        const message =
                                err instanceof Error
                                        ? err.message
                                        : "Не удалось сохранить настройки флага";
                        toast.error("Ошибка сохранения", {
                                description: message,
                        });
                        setError("root", { type: "save", message, types: { save: message } });
                }
        },
        [clearErrors, envState, flag.key, reset, setError],
        );

	const canEdit = Boolean(flag);

        const currentEnv = useMemo(
                () =>
                        envState.find((item) => item.environment === activeEnvironment) ??
                        envState[0],
                [activeEnvironment, envState],
        );

        const rootErrorTypes = (errors.root?.types as Record<string, string> | undefined) ?? {};
        const rootSaveError = rootErrorTypes.save ?? errors.root?.message;
        const rootSegmentsError = rootErrorTypes.segments;

        return (
                <div className="min-h-screen bg-background text-foreground">
			<div className="mx-auto max-w-6xl space-y-6 px-6 pb-12 pt-8">
				<div className="space-y-2">
					<p className="text-sm uppercase tracking-wide text-muted-foreground">
						Управление флагом
					</p>
					<h1 className="text-3xl font-semibold">{flag.key}</h1>
					<p className="text-sm text-muted-foreground">
						Редактируйте основные настройки флага и управляйте конфигурацией
						окружений. Загрузите сегменты и условия, чтобы настроить таргетинг.
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
                                                ID {flag.id ?? "-"}
                                        </Button>
                                </div>

                                {rootSaveError ? (
                                        <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive">
                                                <span>{rootSaveError}</span>
                                        </div>
                                ) : null}

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
									Переключайте окружения и настраивайте правила таргетинга для
									каждого из них.
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
									<SelectTrigger id={envSelectId} className="min-w-[140px]">
										<SelectValue placeholder="Выберите окружение" />
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
                                                {rootSegmentsError ? (
                                                        <p className="text-xs text-destructive">{rootSegmentsError}</p>
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
								Окружения не найдены.
							</div>
						)}
					</div>

                                        <div className="flex flex-wrap items-center gap-3">
                                                <Button type="submit" disabled={!canEdit || isSubmitting}>
                                                        {isSubmitting ? (
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        ) : (
                                                                <Settings2 className="mr-2 h-4 w-4" />
                                                        )}
                                                        Сохранить настройки
                                                </Button>
						<Button variant="outline" size="sm" asChild>
							<Link to="/">Назад</Link>
						</Button>
					</div>
				</form>
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
			phoneIncludeDraft: [],
			phoneExcludeDraft: [],
			birthdateIncludeDraft: [],
			birthdateExcludeDraft: [],
		};
	});
}
