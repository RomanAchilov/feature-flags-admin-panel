import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertTriangle,
	CheckCircle2,
	FlameKindling,
	Loader2,
	Plus,
	RefreshCw,
	Settings2,
	Trash2,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
	createFlag,
	deleteFlag,
	type FeatureEnvironment,
	type FeatureFlag,
	type FeatureFlagEnvironment,
	type FeatureFlagType,
	fetchFlag,
	fetchFlags,
	updateFlag,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type EnvState = FeatureFlagEnvironment & {
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

type EditFlagForm = {
	name: string;
	description: string;
	tagsInput: string;
	type: FeatureFlagType;
	environments: EnvState[];
};

const environmentsOrder: FeatureEnvironment[] = [
	"development",
	"staging",
	"production",
];

const segmentPresets = [
	{ value: "employee", label: "Сотрудник" },
	{ value: "non_employee", label: "Не сотрудник" },
	{ value: "beta", label: "Бета" },
	{ value: "beta_tester", label: "Бета-тестер" },
	{ value: "premium", label: "Премиум" },
	{ value: "vip", label: "VIP" },
	{ value: "new_customer", label: "Новый клиент" },
	{ value: "old_customer", label: "Постоянный клиент" },
];

const envSchema = z.object({
	environment: z.enum(environmentsOrder),
	enabled: z.boolean(),
	rolloutEnabled: z.boolean(),
	rolloutPercentage: z
		.number()
		.min(0, "Не меньше 0")
		.max(100, "Не больше 100")
		.nullable(),
	forceEnabled: z.boolean().nullable().optional().default(null),
	forceDisabled: z.boolean().nullable().optional().default(null),
	userTargets: z
		.array(
			z.object({
				userId: z.string(),
				include: z.boolean(),
			}),
		)
		.optional()
		.default([]),
	includeInput: z.string().optional().default(""),
	excludeInput: z.string().optional().default(""),
	segmentTargets: z
		.array(
			z.object({
				segment: z.string(),
				include: z.boolean(),
			}),
		)
		.optional()
		.default([]),
	segmentInclude: z.array(z.string()).optional().default([]),
	segmentExclude: z.array(z.string()).optional().default([]),
	segmentIncludeDraft: z.string().optional().default(""),
	segmentExcludeDraft: z.string().optional().default(""),
	phoneIncludeDraft: z.string().optional().default(""),
	phoneExcludeDraft: z.string().optional().default(""),
});

const flagFormSchema = z.object({
	key: z.string().min(1, "Укажите ключ"),
	name: z.string().min(1, "Укажите имя"),
	description: z.string().optional(),
	tagsInput: z.string().optional(),
	type: z.enum(["BOOLEAN", "MULTIVARIANT"]),
	environments: z
		.array(envSchema)
		.min(1)
		.superRefine((items, ctx) => {
			items.forEach((env, idx) => {
				if (env.rolloutEnabled && (env.rolloutPercentage ?? null) === null) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "Укажите процент для постепенного включения",
						path: [idx, "rolloutPercentage"],
					});
				}
			});
		}),
});

type CreateFlagForm = z.infer<typeof flagFormSchema>;

export const Route = createFileRoute("/")({
	component: () => <FeatureFlagsDashboard />,
});

function FeatureFlagsDashboard() {
	const [flags, setFlags] = useState<FeatureFlag[]>([]);
	const [selectedKey, setSelectedKey] = useState<string | null>(null);
	const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
	const [listLoading, setListLoading] = useState(true);
	const [detailLoading, setDetailLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [info, setInfo] = useState<string | null>(null);
	const [search, setSearch] = useState("");

	const defaultEnvironments: EnvState[] = useMemo(
		() =>
			environmentsOrder.map((env) => ({
				environment: env,
				enabled: false,
				rolloutPercentage: null,
				rolloutEnabled: false,
				forceEnabled: null,
				forceDisabled: null,
				userTargets: [],
				includeInput: "",
				excludeInput: "",
				segmentTargets: [],
				segmentInclude: [],
				segmentExclude: [],
				segmentIncludeDraft: "",
				segmentExcludeDraft: "",
				phoneIncludeDraft: "",
				phoneExcludeDraft: "",
			})),
		[],
	);

	const createFormDefaults: CreateFlagForm = {
		key: "",
		name: "",
		description: "",
		tagsInput: "",
		type: "BOOLEAN",
		environments: defaultEnvironments,
	};

	const [editForm, setEditForm] = useState<EditFlagForm | null>(null);
	const [creating, setCreating] = useState(false);
	const [updating, setUpdating] = useState(false);
	const [deletingKey, setDeletingKey] = useState<string | null>(null);
	const [togglingKey, setTogglingKey] = useState<string | null>(null);

	const loadFlag = useCallback(async (key: string) => {
		setDetailLoading(true);
		setError(null);
		try {
			const full = await fetchFlag(key);
			setSelectedFlag(full);
			setSelectedKey(key);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Не удалось загрузить флаг",
			);
		} finally {
			setDetailLoading(false);
		}
	}, []);

	const refreshFlags = useCallback(async () => {
		setListLoading(true);
		setError(null);
		try {
			const data = await fetchFlags();
			setFlags(data);
			if (selectedKey) {
				const stillExists = data.some((flag) => flag.key === selectedKey);
				if (stillExists) {
					await loadFlag(selectedKey);
				} else {
					setSelectedKey(null);
					setSelectedFlag(null);
				}
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Не удалось загрузить флаги",
			);
		} finally {
			setListLoading(false);
		}
	}, [loadFlag, selectedKey]);

	useEffect(() => {
		void refreshFlags();
	}, [refreshFlags]);

	useEffect(() => {
		if (!selectedFlag) {
			setEditForm(null);
			return;
		}

		setEditForm({
			name: selectedFlag.name,
			description: selectedFlag.description ?? "",
			tagsInput: selectedFlag.tags.join(", "),
			type: selectedFlag.type,
			environments: environmentsOrder.map((env) => {
				const found = selectedFlag.environments.find(
					(item) => item.environment === env,
				);
				const includeList =
					found?.userTargets
						?.filter((t) => t.include)
						.map((t) => t.userId)
						.join(", ") ?? "";
				const excludeList =
					found?.userTargets
						?.filter((t) => !t.include)
						.map((t) => t.userId)
						.join(", ") ?? "";
				const includeSegments =
					found?.segmentTargets
						?.filter((t) => t.include)
						.map((t) => t.segment) ?? [];
				const excludeSegments =
					found?.segmentTargets
						?.filter((t) => !t.include)
						.map((t) => t.segment) ?? [];

				return (
					(found && {
						...found,
						rolloutEnabled: typeof found.rolloutPercentage === "number",
						includeInput: includeList,
						excludeInput: excludeList,
						segmentInclude: includeSegments,
						segmentExclude: excludeSegments,
						segmentIncludeDraft: "",
						segmentExcludeDraft: "",
						phoneIncludeDraft: "",
						phoneExcludeDraft: "",
					}) || {
						environment: env,
						enabled: false,
						rolloutPercentage: null,
						rolloutEnabled: false,
						forceEnabled: null,
						forceDisabled: null,
						userTargets: [],
						includeInput: "",
						excludeInput: "",
						segmentTargets: [],
						segmentInclude: [],
						segmentExclude: [],
						segmentIncludeDraft: "",
						segmentExcludeDraft: "",
						phoneIncludeDraft: "",
						phoneExcludeDraft: "",
					}
				);
			}),
		});
	}, [selectedFlag]);

	const filteredFlags = useMemo(() => {
		const term = search.trim().toLowerCase();
		if (!term) return flags;
		return flags.filter(
			(flag) =>
				flag.key.toLowerCase().includes(term) ||
				flag.name.toLowerCase().includes(term) ||
				flag.tags.some((tag) => tag.toLowerCase().includes(term)),
		);
	}, [flags, search]);

	const parseTags = (input: string) =>
		input
			.split(",")
			.map((tag) => tag.trim())
			.filter(Boolean);

	const collectUserTargets = (envs: EnvState[]) => {
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

	const collectSegmentTargets = (envs: EnvState[]) => {
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

	const {
		register,
		handleSubmit,
		watch,
		reset,
		setValue,
		formState: { errors },
	} = useForm<CreateFlagForm>({
		resolver: zodResolver(flagFormSchema),
		defaultValues: createFormDefaults,
		mode: "onChange",
	});

	const watchedEnvironments = watch("environments");

	const currentCreateEnv = (env: FeatureEnvironment) =>
		watchedEnvironments?.find((item) => item.environment === env);

	const onCreate = handleSubmit(async (value) => {
		setCreating(true);
		setError(null);
		setInfo(null);

		const payload = {
			key: value.key.trim(),
			name: value.name.trim(),
			description: value.description?.trim() || undefined,
			tags: parseTags(value.tagsInput ?? ""),
			type: value.type,
			environments: value.environments.map((env) => ({
				environment: env.environment,
				enabled: env.enabled,
				rolloutPercentage: env.rolloutEnabled
					? (env.rolloutPercentage ?? 0)
					: null,
				forceEnabled: null,
				forceDisabled: null,
			})),
			userTargets: collectUserTargets(value.environments),
			segmentTargets: collectSegmentTargets(value.environments),
		};

		try {
			const created = await createFlag(payload);
			setInfo(`Флаг ${created.key} создан`);
			const resetEnvs = environmentsOrder.map((env) => ({
				environment: env,
				enabled: false,
				rolloutPercentage: null,
				rolloutEnabled: false,
				forceEnabled: null,
				forceDisabled: null,
				userTargets: [],
				includeInput: "",
				excludeInput: "",
				segmentTargets: [],
				segmentInclude: [],
				segmentExclude: [],
				segmentIncludeDraft: "",
				segmentExcludeDraft: "",
				phoneIncludeDraft: "",
				phoneExcludeDraft: "",
			}));
			reset({
				key: "",
				name: "",
				description: "",
				tagsInput: "",
				type: "BOOLEAN",
				environments: resetEnvs,
			});
			await refreshFlags();
			await loadFlag(created.key);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Не удалось создать флаг");
		} finally {
			setCreating(false);
		}
	});

	const handleUpdate = async () => {
		if (!selectedFlag || !editForm) return;
		setUpdating(true);
		setError(null);
		setInfo(null);

		try {
			const payload = {
				name: editForm.name.trim(),
				description: editForm.description.trim() || null,
				tags: parseTags(editForm.tagsInput),
				type: editForm.type,
				environments: editForm.environments.map((env) => ({
					environment: env.environment,
					enabled: env.enabled,
					rolloutPercentage: env.rolloutEnabled
						? (env.rolloutPercentage ?? 0)
						: null,
					forceEnabled: null,
					forceDisabled: null,
				})),
				userTargets: collectUserTargets(editForm.environments),
				segmentTargets: collectSegmentTargets(editForm.environments),
			};
			await updateFlag(selectedFlag.key, payload);
			setInfo("Настройки сохранены");
			await refreshFlags();
			await loadFlag(selectedFlag.key);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Не удалось обновить флаг");
		} finally {
			setUpdating(false);
		}
	};

	const handleDelete = async (key: string) => {
		const agreed = window.confirm(
			`Удалить флаг ${key}? Данные останутся в аудите.`,
		);
		if (!agreed) return;

		setDeletingKey(key);
		setError(null);
		setInfo(null);
		try {
			await deleteFlag(key);
			setInfo(`Флаг ${key} удален`);
			await refreshFlags();
			if (selectedKey === key) {
				setSelectedKey(null);
				setSelectedFlag(null);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Не удалось удалить флаг");
		} finally {
			setDeletingKey(null);
		}
	};

	const toggleEnvironment = async (
		flagKey: string,
		env: FeatureEnvironment,
		enabled: boolean,
	) => {
		setTogglingKey(`${flagKey}-${env}`);
		setError(null);
		setInfo(null);
		try {
			await updateFlag(flagKey, {
				environments: [{ environment: env, enabled }],
			});
			await refreshFlags();
			if (selectedKey === flagKey) {
				await loadFlag(flagKey);
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Не удалось изменить статус флага",
			);
		} finally {
			setTogglingKey(null);
		}
	};

	const updateCreateEnv = (
		env: FeatureEnvironment,
		changes: Partial<EnvState>,
	) => {
		const prev = watchedEnvironments ?? defaultEnvironments;
		const next = prev.map((item) =>
			item.environment === env ? { ...item, ...changes } : item,
		);
		setValue("environments", next, { shouldDirty: true, shouldValidate: true });
	};

	const updateEditEnv = (
		env: FeatureEnvironment,
		changes: Partial<EnvState>,
	) => {
		setEditForm((prev) =>
			prev
				? {
						...prev,
						environments: prev.environments.map((item) =>
							item.environment === env ? { ...item, ...changes } : item,
						),
					}
				: prev,
		);
	};

	const keyId = useId();
	const nameId = useId();
	const descId = useId();
	const tagsId = useId();
	const typeId = useId();

	return (
		<div className="min-h-screen bg-background text-foreground">
			<div className="mx-auto max-w-6xl px-6 pb-12 pt-8 space-y-6">
				<div className="flex flex-wrap items-center gap-3">
					<div className="rounded-xl border p-3">
						<FlameKindling className="h-6 w-6" />
					</div>
					<div>
						<p className="text-sm uppercase tracking-wide text-muted-foreground">
							Фич-флаги
						</p>
						<h1 className="text-3xl font-semibold">
							Консоль управления фичами
						</h1>
						<p className="text-muted-foreground">
							Создавайте, настраивайте, включайте и удаляйте флаги для разных
							окружений и сегментов пользователей.
						</p>
					</div>
					<div className="ml-auto flex items-center gap-3">
						<Button
							variant="outline"
							size="sm"
							onClick={() => void refreshFlags()}
							disabled={listLoading}
						>
							{listLoading ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<RefreshCw className="h-4 w-4" />
							)}
							Обновить
						</Button>
					</div>
				</div>

				{error ? (
					<div className="mt-6 flex items-center gap-3 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-red-100">
						<AlertTriangle className="h-5 w-5" />
						<span>{error}</span>
					</div>
				) : null}
				{info ? (
					<div className="mt-6 flex items-center gap-3 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-emerald-100">
						<CheckCircle2 className="h-5 w-5" />
						<span>{info}</span>
					</div>
				) : null}

				<div className="mt-4 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
					<section className="rounded-2xl border bg-card p-6 shadow-sm">
						<div className="flex items-center justify-between">
							<h2 className="text-xl font-semibold">Создать новый флаг</h2>
							<span className="text-xs uppercase tracking-wide text-muted-foreground">
								Шаг 1
							</span>
						</div>
						<p className="mt-1 text-sm text-muted-foreground">
							Минимально заполните ключ и имя. Остальное можно донастроить
							позже.
						</p>

						<form className="mt-4 space-y-4" onSubmit={onCreate}>
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor={keyId}>Ключ</Label>
									<Input
										id={keyId}
										placeholder="checkout-new-flow"
										{...register("key")}
										aria-invalid={errors.key ? "true" : "false"}
									/>
									<FieldError message={errors.key?.message} />
								</div>
								<div className="space-y-2">
									<Label htmlFor={nameId}>РРјСЏ</Label>
									<Input
										id={nameId}
										placeholder="Новый флоу оплаты"
										{...register("name")}
										aria-invalid={errors.name ? "true" : "false"}
									/>
									<FieldError message={errors.name?.message} />
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor={descId}>Описание</Label>
								<Textarea
									id={descId}
									placeholder="Для кого предназначен, что включает."
									{...register("description")}
								/>
							</div>

							<div className="grid gap-4 md:grid-cols-3">
								<div className="space-y-2">
									<Label htmlFor={typeId}>Тип</Label>
									<select
										id={typeId}
										className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
										{...register("type")}
									>
										<option value="BOOLEAN">Булевый</option>
										<option value="MULTIVARIANT">Вариантный (A/B/N)</option>
									</select>
								</div>
								<div className="space-y-2 md:col-span-2">
									<Label htmlFor={tagsId}>Тэги</Label>
									<Input
										id={tagsId}
										placeholder="growth, checkout"
										{...register("tagsInput")}
									/>
									<p className="text-xs text-muted-foreground">
										Через запятую (ярлыки для поиска)
									</p>
								</div>
							</div>

							<div className="grid gap-3 md:grid-cols-3">
								{environmentsOrder.map((env) => {
									const envState =
										currentCreateEnv(env) ??
										({
											environment: env,
											enabled: false,
											rolloutPercentage: null,
											rolloutEnabled: false,
											forceEnabled: null,
											forceDisabled: null,
											userTargets: [],
											includeInput: "",
											excludeInput: "",
											segmentTargets: [],
											segmentInclude: [],
											segmentExclude: [],
											segmentIncludeDraft: "",
											segmentExcludeDraft: "",
											phoneIncludeDraft: "",
											phoneExcludeDraft: "",
										} satisfies EnvState);
									return (
										<EnvironmentCard
											key={env}
											env={envState}
											onChange={(changes) => updateCreateEnv(env, changes)}
										/>
									);
								})}
							</div>

							<div className="flex justify-end">
								<Button type="submit" disabled={creating}>
									{creating ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Plus className="h-4 w-4" />
									)}
									Создать флаг
								</Button>
							</div>
						</form>
					</section>

					<section className="rounded-2xl border bg-card p-6 shadow-sm">
						<div className="flex items-center justify-between">
							<div>
								<h2 className="text-xl font-semibold">Флаги</h2>
								<p className="text-sm text-muted-foreground">
									Быстрое включение/выключение и выбор для настроек.
								</p>
							</div>
							<Settings2 className="h-5 w-5 text-muted-foreground" />
						</div>

						<div className="mt-4">
							<Input
								placeholder="Поиск по ключу, имени или тэгу"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
						</div>

						<div className="mt-4 space-y-3">
							{listLoading ? (
								<div className="flex items-center justify-center gap-2 rounded-lg border bg-muted/30 p-4">
									<Loader2 className="h-5 w-5 animate-spin" />
									<span>Загрузка...</span>
								</div>
							) : filteredFlags.length === 0 ? (
								<div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-muted-foreground">
									Пока нет флагов. Создайте первый!
								</div>
							) : (
								filteredFlags.map((flag) => (
									<article
										key={flag.key}
										className={cn(
											"rounded-lg border bg-card p-4 transition duration-150 hover:border-primary/50",
											selectedKey === flag.key && "border-primary shadow-sm",
										)}
									>
										<div className="flex flex-wrap items-center gap-3">
											<div className="min-w-0">
												<p className="text-xs uppercase tracking-wide text-muted-foreground">
													Ключ
												</p>
												<p className="truncate text-lg font-semibold">
													{flag.key}
												</p>
												<p className="text-sm text-muted-foreground">
													{flag.name}
												</p>
												<div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
													<span className="rounded-full border px-3 py-1 font-medium">
														{flag.type === "MULTIVARIANT"
															? "Вариантный"
															: "Булевый"}
													</span>
													{flag.tags.map((tag) => (
														<span
															key={tag}
															className="rounded-full border px-3 py-1"
														>
															{tag}
														</span>
													))}
												</div>
											</div>
											<div className="ml-auto flex flex-col gap-2">
												<div className="grid grid-cols-3 gap-2">
													{environmentsOrder.map((env) => {
														const envState =
															flag.environments.find(
																(item) => item.environment === env,
															) ??
															({
																environment: env,
																enabled: false,
															} as FeatureFlagEnvironment);

														return (
															<div
																key={env}
																className="rounded-md border bg-muted/30 px-3 py-2 text-xs"
															>
																<div className="flex items-center justify-between gap-2">
																	<span className="uppercase tracking-wide text-[10px] text-muted-foreground">
																		{env}
																	</span>
																	<Switch
																		checked={!!envState.enabled}
																		disabled={
																			togglingKey === `${flag.key}-${env}`
																		}
																		onCheckedChange={(checked) =>
																			void toggleEnvironment(
																				flag.key,
																				env,
																				checked,
																			)
																		}
																	/>
																</div>
																<p className="mt-1 text-[11px] text-muted-foreground">
																	{envState.enabled ? "Включен" : "Выключен"}
																</p>
															</div>
														);
													})}
												</div>
												<div className="flex flex-wrap justify-end gap-2">
													<Button
														size="sm"
														variant={
															selectedKey === flag.key ? "default" : "outline"
														}
														onClick={() => void loadFlag(flag.key)}
													>
														Настроить
													</Button>
													<Button
														size="sm"
														variant="destructive"
														disabled={deletingKey === flag.key}
														onClick={() => void handleDelete(flag.key)}
													>
														{deletingKey === flag.key ? (
															<Loader2 className="h-4 w-4 animate-spin" />
														) : (
															<Trash2 className="h-4 w-4" />
														)}
														Удалить
													</Button>
												</div>
											</div>
										</div>
									</article>
								))
							)}
						</div>
					</section>
				</div>

				<section className="mt-8 rounded-2xl border bg-card p-6 shadow-sm">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-xl font-semibold">Настройки флага</h2>
							<p className="text-sm text-muted-foreground">
								Выберите флаг слева, чтобы менять тип, теги и параметры
								окружений.
							</p>
						</div>
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<Settings2 className="h-4 w-4" />
							<span>Шаг 2</span>
						</div>
					</div>

					{!selectedFlag ? (
						<div className="mt-6 rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-muted-foreground">
							Ничего не выбрано. Кликните «Настроить» у нужного флага.
						</div>
					) : detailLoading || !editForm ? (
						<div className="mt-6 flex items-center gap-2 rounded-lg border bg-muted/30 p-4">
							<Loader2 className="h-5 w-5 animate-spin" />
							<span>Загружаем детали...</span>
						</div>
					) : (
						<div className="mt-6 space-y-4">
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label>РРјСЏ</Label>
									<Input
										value={editForm.name}
										onChange={(e) =>
											setEditForm((prev) =>
												prev ? { ...prev, name: e.target.value } : prev,
											)
										}
									/>
								</div>
								<div className="space-y-2">
									<Label>Тип</Label>
									<select
										className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
										value={editForm.type}
										onChange={(e) =>
											setEditForm((prev) =>
												prev
													? {
															...prev,
															type: e.target.value as FeatureFlagType,
														}
													: prev,
											)
										}
									>
										<option value="BOOLEAN">Булевый</option>
										<option value="MULTIVARIANT">Вариантный (A/B/N)</option>
									</select>
								</div>
							</div>

							<div className="space-y-2">
								<Label>Описание</Label>
								<Textarea
									value={editForm.description}
									onChange={(e) =>
										setEditForm((prev) =>
											prev ? { ...prev, description: e.target.value } : prev,
										)
									}
								/>
							</div>

							<div className="space-y-2">
								<Label>Тэги</Label>
								<Input
									value={editForm.tagsInput}
									onChange={(e) =>
										setEditForm((prev) =>
											prev ? { ...prev, tagsInput: e.target.value } : prev,
										)
									}
								/>
								<p className="text-xs text-muted-foreground">Через запятую</p>
							</div>

							<div className="grid gap-3 md:grid-cols-3">
								{environmentsOrder.map((env) => {
									const envState = editForm.environments.find(
										(item) => item.environment === env,
									);
									if (!envState) return null;
									return (
										<EnvironmentCard
											key={env}
											env={envState}
											onChange={(changes) => updateEditEnv(env, changes)}
										/>
									);
								})}
							</div>

							<div className="flex justify-end">
								<Button onClick={() => void handleUpdate()} disabled={updating}>
									{updating ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Settings2 className="h-4 w-4" />
									)}
									Сохранить изменения
								</Button>
							</div>
						</div>
					)}
				</section>
			</div>
		</div>
	);
}

function EnvironmentCard({
	env,
	onChange,
}: {
	env: EnvState;
	onChange: (changes: Partial<EnvState>) => void;
}) {
	const includeId = useId();
	const excludeId = useId();
	const segmentIncludeId = useId();
	const segmentExcludeId = useId();
	const segmentPresetIncludeId = useId();
	const segmentPresetExcludeId = useId();
	const phoneIncludeId = useId();
	const phoneExcludeId = useId();

	return (
		<div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
			<div className="flex items-center justify-between">
				<div>
					<p className="text-xs uppercase tracking-wide text-muted-foreground">
						{env.environment}
					</p>
					<p className="text-sm text-muted-foreground">
						{env.enabled ? "Включен" : "Выключен"}{" "}
						{env.rolloutEnabled && typeof env.rolloutPercentage === "number"
							? `(${env.rolloutPercentage}%)`
							: ""}
					</p>
				</div>
				<Switch
					checked={env.enabled}
					onCheckedChange={(checked) => onChange({ enabled: checked })}
				/>
			</div>

			<div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
				<span>Постепенное включение</span>
				<Switch
					checked={env.rolloutEnabled}
					onCheckedChange={(checked) =>
						onChange({
							rolloutEnabled: checked,
							rolloutPercentage: checked ? (env.rolloutPercentage ?? 0) : null,
						})
					}
				/>
			</div>

			{env.rolloutEnabled ? (
				<div className="space-y-2">
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						<span>Доля трафика</span>
						<span className="font-semibold">{env.rolloutPercentage ?? 0}%</span>
					</div>
					<Slider
						min={0}
						max={100}
						step={5}
						value={[env.rolloutPercentage ?? 0]}
						onValueChange={(values) =>
							onChange({ rolloutPercentage: values[0] ?? 0 })
						}
					/>
				</div>
			) : null}

			<div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
				<div className="space-y-1">
					<Label htmlFor={includeId} className="text-[11px] font-medium">
						Включить для пользователей (ID)
					</Label>
					<Textarea
						id={includeId}
						value={env.includeInput}
						onChange={(e) => onChange({ includeInput: e.target.value })}
						placeholder="uid1, uid2"
						className="h-20"
					/>
					<p className="text-[11px] text-muted-foreground">
						Через запятую или новую строку.
					</p>
				</div>
				<div className="space-y-1">
					<Label htmlFor={excludeId} className="text-[11px] font-medium">
						Исключить пользователей (ID)
					</Label>
					<Textarea
						id={excludeId}
						value={env.excludeInput}
						onChange={(e) => onChange({ excludeInput: e.target.value })}
						placeholder="uid3, uid4"
						className="h-20"
					/>
					<p className="text-[11px] text-muted-foreground">
						Исключение важнее процента раскатки.
					</p>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
				<TagInput
					id={segmentIncludeId}
					label="Включить сегменты"
					values={env.segmentInclude}
					inputValue={env.segmentIncludeDraft}
					onInputChange={(value) => onChange({ segmentIncludeDraft: value })}
					onAdd={(value) =>
						onChange({
							segmentInclude: addSegment(env.segmentInclude, value),
							segmentIncludeDraft: "",
						})
					}
					onRemove={(value) =>
						onChange({
							segmentInclude: env.segmentInclude.filter(
								(segment) => segment !== value,
							),
						})
					}
					placeholder="employee, phone-last4:1234"
					helper="Свободный ввод. Пример: employee, beta, birthdate:1990-01-01."
				/>
				<TagInput
					id={segmentExcludeId}
					label="Исключить сегменты"
					values={env.segmentExclude}
					inputValue={env.segmentExcludeDraft}
					onInputChange={(value) => onChange({ segmentExcludeDraft: value })}
					onAdd={(value) =>
						onChange({
							segmentExclude: addSegment(env.segmentExclude, value),
							segmentExcludeDraft: "",
						})
					}
					onRemove={(value) =>
						onChange({
							segmentExclude: env.segmentExclude.filter(
								(segment) => segment !== value,
							),
						})
					}
					placeholder="non_employee, old_customer"
					helper="Исключаемые сегменты: non_employee, old_customer и др."
				/>
			</div>

			<div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
				<div className="space-y-1">
					<Label
						htmlFor={segmentPresetIncludeId}
						className="text-[11px] font-medium"
					>
						Быстрый выбор сегмента (включить)
					</Label>
					<select
						id={segmentPresetIncludeId}
						className="w-full rounded-md border bg-background px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
						value=""
						onChange={(e) => {
							const value = e.target.value;
							if (!value) return;
							onChange({
								segmentInclude: addSegment(env.segmentInclude, value),
							});
						}}
					>
						<option value="">Выберите…</option>
						{segmentPresets.map((preset) => (
							<option key={preset.value} value={preset.value}>
								{preset.label}
							</option>
						))}
					</select>
					<p className="text-[11px] text-muted-foreground">
						Примеры: employee, beta, premium, new_customer и др.
					</p>
				</div>
				<div className="space-y-1">
					<Label
						htmlFor={segmentPresetExcludeId}
						className="text-[11px] font-medium"
					>
						Быстрый выбор сегмента (исключить)
					</Label>
					<select
						id={segmentPresetExcludeId}
						className="w-full rounded-md border bg-background px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
						value=""
						onChange={(e) => {
							const value = e.target.value;
							if (!value) return;
							onChange({
								segmentExclude: addSegment(env.segmentExclude, value),
							});
						}}
					>
						<option value="">Выберите…</option>
						{segmentPresets.map((preset) => (
							<option key={preset.value} value={preset.value}>
								{preset.label}
							</option>
						))}
					</select>
					<p className="text-[11px] text-muted-foreground">
						Быстро исключить группу пользователей.
					</p>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
				<div className="space-y-1">
					<Label htmlFor={phoneIncludeId} className="text-[11px] font-medium">
						Телефон (включить по номеру или последним цифрам)
					</Label>
					<div className="flex gap-2">
						<Input
							id={phoneIncludeId}
							value={env.phoneIncludeDraft}
							onChange={(e) => onChange({ phoneIncludeDraft: e.target.value })}
							placeholder="+7 999 111 2233 или 1234"
							className="text-xs"
						/>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() =>
								onChange({ phoneIncludeDraft: env.phoneIncludeDraft.trim() })
							}
						>
							Добавить
						</Button>
					</div>
					<p className="text-[11px] text-muted-foreground">
						Создаст сегменты phone:NNN и phone-last4:XXXX (если длина ≥ 4).
					</p>
				</div>
				<div className="space-y-1">
					<Label htmlFor={phoneExcludeId} className="text-[11px] font-medium">
						Телефон (исключить)
					</Label>
					<div className="flex gap-2">
						<Input
							id={phoneExcludeId}
							value={env.phoneExcludeDraft}
							onChange={(e) => onChange({ phoneExcludeDraft: e.target.value })}
							placeholder="+7 999 111 2233 или 4321"
							className="text-xs"
						/>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() =>
								onChange({ phoneExcludeDraft: env.phoneExcludeDraft.trim() })
							}
						>
							Добавить
						</Button>
					</div>
					<p className="text-[11px] text-muted-foreground">
						Можно указать номер целиком или только последние цифры.
					</p>
				</div>
			</div>
		</div>
	);
}

function FieldError({ message }: { message?: string }) {
	if (!message) return null;
	return <p className="text-xs text-destructive">{message}</p>;
}

const addSegment = (segments: string[], value: string) => {
	const normalized = value.trim();
	if (!normalized) return segments;
	const lower = normalized.toLowerCase();
	if (segments.includes(lower)) return segments;
	return [...segments, lower];
};

function TagInput({
	id,
	label,
	values,
	inputValue,
	onInputChange,
	onAdd,
	onRemove,
	placeholder,
	helper,
}: {
	id: string;
	label: string;
	values: string[];
	inputValue: string;
	onInputChange: (value: string) => void;
	onAdd: (value: string) => void;
	onRemove: (value: string) => void;
	placeholder?: string;
	helper?: string;
}) {
	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (["Enter", "Tab", ","].includes(event.key)) {
			event.preventDefault();
			onAdd(inputValue);
		}
	};

	return (
		<div className="space-y-1">
			<Label htmlFor={id} className="text-[11px] font-medium">
				{label}
			</Label>
			<div className="flex flex-wrap gap-2 rounded-md border bg-muted/30 p-2">
				{values.map((value) => (
					<span
						key={value}
						className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/40 px-2 py-1 text-[11px] font-medium"
					>
						{value}
						<button
							type="button"
							className="text-muted-foreground hover:text-destructive"
							onClick={() => onRemove(value)}
						>
							x
						</button>
					</span>
				))}
				<input
					id={id}
					value={inputValue}
					onChange={(e) => onInputChange(e.target.value)}
					onKeyDown={handleKeyDown}
					onBlur={() => {
						if (inputValue.trim()) onAdd(inputValue);
					}}
					placeholder={placeholder}
					className="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-xs outline-none placeholder:text-muted-foreground"
				/>
			</div>
			{helper ? (
				<p className="text-[11px] text-muted-foreground">{helper}</p>
			) : null}
		</div>
	);
}
