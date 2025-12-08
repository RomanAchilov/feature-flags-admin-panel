import { createFileRoute, Link } from "@tanstack/react-router";
import {
	AlertTriangle,
	CheckCircle2,
	Loader2,
	RefreshCw,
	Settings2,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
	deleteFlag,
	type FeatureEnvironment,
	type FeatureFlag,
	type FeatureFlagEnvironment,
	fetchFlags,
	updateFlag,
} from "@/lib/api";
import { environmentsOrder } from "@/lib/flag-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
	component: () => <FeatureFlagsDashboard />,
});

export function FeatureFlagsDashboard() {
	const [flags, setFlags] = useState<FeatureFlag[]>([]);
	const [listLoading, setListLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [info, setInfo] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [togglingKey, setTogglingKey] = useState<string | null>(null);
	const [deletingKey, setDeletingKey] = useState<string | null>(null);
	const [confirmationAction, setConfirmationAction] = useState<
		| {
				type: "toggle";
				flagKey: string;
				environment: FeatureEnvironment;
				enabled: boolean;
		  }
		| { type: "delete"; flagKey: string }
		| null
	>(null);
	const [confirmationInput, setConfirmationInput] = useState("");

	const refreshFlags = useCallback(async () => {
		setListLoading(true);
		setError(null);
		try {
			const data = await fetchFlags();
			setFlags(data);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Не удалось загрузить список флагов",
			);
		} finally {
			setListLoading(false);
		}
	}, []);

	useEffect(() => {
		void refreshFlags();
	}, [refreshFlags]);

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

	const resetConfirmation = useCallback(() => {
		setConfirmationAction(null);
		setConfirmationInput("");
	}, []);

	const toggleEnvironment = useCallback(
		async (flagKey: string, env: FeatureEnvironment, enabled: boolean) => {
			setTogglingKey(`${flagKey}-${env}`);
			setError(null);
			setInfo(null);
			try {
				await updateFlag(flagKey, {
					environments: [{ environment: env, enabled }],
				});
				setInfo("Состояние обновлено");
				await refreshFlags();
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Не удалось обновить окружение",
				);
			} finally {
				setTogglingKey(null);
			}
		},
		[refreshFlags],
	);

	const requestToggle = useCallback(
		(flagKey: string, env: FeatureEnvironment, enabled: boolean) => {
			if (env === "production") {
				setConfirmationInput("");
				setConfirmationAction({
					type: "toggle",
					flagKey,
					environment: env,
					enabled,
				});
				return;
			}
			void toggleEnvironment(flagKey, env, enabled);
		},
		[toggleEnvironment],
	);

	const performDelete = useCallback(
		async (key: string) => {
			setDeletingKey(key);
			setError(null);
			setInfo(null);
			try {
				await deleteFlag(key);
				setInfo(`Флаг ${key} удалён`);
				await refreshFlags();
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Не удалось удалить флаг",
				);
			} finally {
				setDeletingKey(null);
			}
		},
		[refreshFlags],
	);

	const requestDelete = useCallback((key: string) => {
		setConfirmationInput("");
		setConfirmationAction({ type: "delete", flagKey: key });
	}, []);

	const confirmAction = useCallback(async () => {
		if (!confirmationAction) return;
		if (confirmationAction.type === "toggle") {
			await toggleEnvironment(
				confirmationAction.flagKey,
				confirmationAction.environment,
				confirmationAction.enabled,
			);
		} else {
			await performDelete(confirmationAction.flagKey);
		}
		resetConfirmation();
	}, [confirmationAction, performDelete, resetConfirmation, toggleEnvironment]);

	const confirmationFlagKey = confirmationAction?.flagKey ?? "";
	const confirmationActionLabel =
		confirmationAction?.type === "toggle"
			? confirmationAction.enabled
				? "Включить"
				: "Выключить"
			: "Удалить";
	const confirmationDescription =
		confirmationAction?.type === "toggle"
			? `Вы собираетесь ${confirmationAction.enabled ? "включить" : "выключить"} production окружение для флага ${confirmationAction.flagKey}.`
			: `Флаг ${confirmationAction?.flagKey ?? ""} будет удалён без возможности восстановления.`;
	const confirmationInProgress = confirmationAction
		? confirmationAction.type === "toggle"
			? togglingKey ===
				`${confirmationAction.flagKey}-${confirmationAction.environment}`
			: deletingKey === confirmationAction.flagKey
		: false;
	const confirmationDisabled =
		confirmationFlagKey.length === 0 ||
		confirmationInput !== confirmationFlagKey ||
		confirmationInProgress;

	return (
		<>
			<div className="min-h-screen bg-background text-foreground">
				<div className="mx-auto max-w-6xl px-6 pb-12 pt-8 space-y-6">
					<div className="flex flex-wrap items-center gap-3">
						<div>
							<p className="text-sm uppercase tracking-wide text-muted-foreground">
								Панель управления
							</p>
							<h1 className="text-3xl font-semibold">Фичи и флаги</h1>
							<p className="text-sm text-muted-foreground">
								Лист и настройки всех текущих флагов, поиск по ключу, описанию
								или тегам. Используйте переключатели для быстрого
								включения/выключения окружений.
							</p>
						</div>
						<div className="ml-auto flex flex-wrap items-center gap-3">
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
						<div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive">
							<AlertTriangle className="h-5 w-5" />
							<span>{error}</span>
						</div>
					) : null}
					{info ? (
						<div className="flex items-center gap-3 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-emerald-100">
							<CheckCircle2 className="h-5 w-5" />
							<span>{info}</span>
						</div>
					) : null}

					<section className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
						<div className="space-y-2">
							<h2 className="text-xl font-semibold">Список флагов</h2>
							<p className="text-sm text-muted-foreground">
								Флаги отображаются карточками, в каждой видны тип, теги и
								текущее состояние окружений.
							</p>
						</div>

						<Input
							placeholder="Поиск по ключу, имени или тегу"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
						/>

						<div className="space-y-4">
							{listLoading ? (
								<div className="flex items-center justify-center gap-2 rounded-lg border bg-muted/30 p-6 text-muted-foreground">
									<Loader2 className="h-5 w-5 animate-spin" />
									Загрузка...
								</div>
							) : filteredFlags.length === 0 ? (
								<div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-muted-foreground">
									Флаги не найдены. Попробуйте другой запрос.
								</div>
							) : (
								<div className="grid gap-4 md:grid-cols-2">
									{filteredFlags.map((flag) => (
										<article
											key={flag.key}
											className={cn(
												"rounded-2xl border bg-card p-5 shadow-sm transition",
												deletingKey === flag.key && "opacity-60",
											)}
										>
											<div className="flex items-start gap-4">
												<div className="flex-1 space-y-1">
													<p className="text-xs uppercase tracking-wide text-muted-foreground">
														{flag.type === "MULTIVARIANT"
															? "A/B тест"
															: "Булев"}
													</p>
													<h3 className="text-lg font-semibold text-foreground">
														{flag.key}
													</h3>
													<p className="truncate text-sm text-muted-foreground">
														{flag.name}
													</p>
													<div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
														{flag.tags.length === 0 ? (
															<span className="rounded-full border px-3 py-1">
																Без тегов
															</span>
														) : (
															flag.tags.map((tag) => (
																<span
																	key={tag}
																	className="rounded-full border px-3 py-1"
																>
																	{tag}
																</span>
															))
														)}
													</div>
													<div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
														<span className="rounded-full border px-3 py-1">
															{flag.type === "MULTIVARIANT"
																? "A/B/N"
																: "Boolean"}
														</span>
														<span className="rounded-full border px-3 py-1">
															{flag.environments.length} окружений
														</span>
													</div>
												</div>
											</div>

											<p className="mt-4 text-sm text-muted-foreground">
												{flag.description ?? "Описание отсутствует."}
											</p>

											<div className="mt-5 grid gap-3 md:grid-cols-3">
												{environmentsOrder.map((env) => {
													const envState =
														flag.environments.find(
															(item) => item.environment === env,
														) ??
														({
															environment: env,
															enabled: false,
															rolloutPercentage: null,
															forceEnabled: null,
															forceDisabled: null,
															userTargets: [],
															segmentTargets: [],
														} as FeatureFlagEnvironment);

													return (
														<div
															key={env}
															className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3 text-xs"
														>
															<div className="flex items-center justify-between">
																<span className="uppercase tracking-wide text-[10px] text-muted-foreground">
																	{env}
																</span>
																<Switch
																	checked={!!envState.enabled}
																	disabled={
																		togglingKey === `${flag.key}-${env}`
																	}
																	aria-label={`Переключатель ${env} для ${flag.key}`}
																	onCheckedChange={(checked) =>
																		requestToggle(flag.key, env, checked)
																	}
																/>
															</div>
															<p className="text-[11px] text-muted-foreground">
																{envState.enabled ? "Работает" : "Выключено"}
															</p>
															<p className="text-[11px] text-muted-foreground">
																{envState.rolloutPercentage !== null &&
																envState.rolloutPercentage !== undefined
																	? `Роллаут ${envState.rolloutPercentage}%`
																	: "Роллаут по умолчанию"}
															</p>
														</div>
													);
												})}
											</div>

											<div className="mt-5 flex flex-wrap items-center gap-3">
												<Button size="sm" variant="outline" asChild>
													<Link
														to={
															`/flags/${encodeURIComponent(flag.key)}` as "/flags/$flagKey"
														}
														params={{ flagKey: flag.key }}
													>
														<Settings2 className="mr-2 h-4 w-4" />
														Настройки
													</Link>
												</Button>
												<Button
													size="sm"
													variant="destructive"
													disabled={deletingKey === flag.key}
													onClick={() => requestDelete(flag.key)}
												>
													{deletingKey === flag.key ? (
														<Loader2 className="h-4 w-4 animate-spin" />
													) : (
														<Trash2 className="h-4 w-4" />
													)}
													Удалить
												</Button>
											</div>
										</article>
									))}
								</div>
							)}
						</div>
					</section>
				</div>
			</div>
			<AlertDialog
				open={confirmationAction !== null}
				onOpenChange={(open) => {
					if (!open) {
						resetConfirmation();
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{confirmationAction?.type === "toggle"
								? `${confirmationActionLabel} production`
								: "Удалить флаг?"}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{confirmationDescription}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="space-y-2">
						<p className="text-xs text-muted-foreground">
							Для подтверждения введите ключ{" "}
							<span className="font-semibold text-foreground">
								{confirmationFlagKey}
							</span>
							.
						</p>
						<Input
							autoFocus
							placeholder="Введите ключ флага"
							value={confirmationInput}
							onChange={(event) => setConfirmationInput(event.target.value)}
						/>
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel
							onClick={() => {
								resetConfirmation();
							}}
							disabled={confirmationInProgress}
						>
							Отменить
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={confirmationDisabled}
							onClick={(event) => {
								event.preventDefault();
								void confirmAction();
							}}
						>
							{confirmationInProgress ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : null}
							{confirmationActionLabel}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
