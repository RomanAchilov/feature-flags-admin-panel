import {
	AlertTriangle,
	Cake,
	Hash,
	Loader2,
	Percent,
	Phone,
	Plus,
	Users,
	X,
} from "lucide-react";
import { useEffect, useId, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { withMask } from "use-mask-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldGroup,
	FieldSet,
	FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
	addSegment,
	deriveBirthdateSegments,
	derivePhoneSegments,
	type EnvState,
	formatToRuDate,
	getSegmentDescription,
	type PhoneMatchMode,
	parseRuDate,
	phoneMatchModeLabels,
} from "@/lib/flag-utils";

type EnvironmentCardProps = {
	env: EnvState;
	availableSegments: string[];
	onChange: (changes: Partial<EnvState>) => void;
	onCreateSegment: (name: string) => Promise<string>;
};

type EnvFormValues = {
	enabled: boolean;
	rolloutEnabled: boolean;
	rolloutPercentage: number;
	segmentInclude: string[];
	segmentExclude: string[];
	phoneIncludeDraft: string;
	phoneExcludeDraft: string;
	phoneIncludeMode: PhoneMatchMode;
	phoneExcludeMode: PhoneMatchMode;
	birthdateIncludeDraft: string;
	birthdateExcludeDraft: string;
	newSegment: string;
};

export function EnvironmentCard({
	env,
	availableSegments,
	onChange,
	onCreateSegment,
}: EnvironmentCardProps) {
	const formId = useId();

	const { control, watch, setValue, getValues, formState } =
		useForm<EnvFormValues>({
			defaultValues: {
				enabled: env.enabled,
				rolloutEnabled: env.rolloutEnabled,
				rolloutPercentage: env.rolloutPercentage ?? 0,
				segmentInclude: env.segmentInclude,
				segmentExclude: env.segmentExclude,
				phoneIncludeDraft: env.phoneIncludeDraft,
				phoneExcludeDraft: env.phoneExcludeDraft,
				phoneIncludeMode: env.phoneIncludeMode,
				phoneExcludeMode: env.phoneExcludeMode,
				birthdateIncludeDraft: env.birthdateIncludeDraft,
				birthdateExcludeDraft: env.birthdateExcludeDraft,
				newSegment: "",
			},
		});

	// Синхронизируем при изменении env извне
	useEffect(() => {
		setValue("enabled", env.enabled);
		setValue("rolloutEnabled", env.rolloutEnabled);
		setValue("rolloutPercentage", env.rolloutPercentage ?? 0);
		setValue("segmentInclude", env.segmentInclude);
		setValue("segmentExclude", env.segmentExclude);
		setValue("phoneIncludeDraft", env.phoneIncludeDraft);
		setValue("phoneExcludeDraft", env.phoneExcludeDraft);
		setValue("phoneIncludeMode", env.phoneIncludeMode);
		setValue("phoneExcludeMode", env.phoneExcludeMode);
		setValue("birthdateIncludeDraft", env.birthdateIncludeDraft);
		setValue("birthdateExcludeDraft", env.birthdateExcludeDraft);
	}, [env, setValue]);

	const enabled = watch("enabled");
	const rolloutEnabled = watch("rolloutEnabled");
	const rolloutPercentage = watch("rolloutPercentage");
	const segmentInclude = watch("segmentInclude");
	const segmentExclude = watch("segmentExclude");
	const phoneIncludeDraft = watch("phoneIncludeDraft");
	const phoneExcludeDraft = watch("phoneExcludeDraft");
	const phoneIncludeMode = watch("phoneIncludeMode");
	const phoneExcludeMode = watch("phoneExcludeMode");
	const birthdateIncludeDraft = watch("birthdateIncludeDraft");
	const birthdateExcludeDraft = watch("birthdateExcludeDraft");

	// Проверяем есть ли какие-то правила таргетинга
	const hasTargetingRules =
		segmentInclude.length > 0 ||
		segmentExclude.length > 0 ||
		rolloutEnabled ||
		phoneIncludeDraft ||
		phoneExcludeDraft ||
		birthdateIncludeDraft ||
		birthdateExcludeDraft;

	// Описание текущего состояния для пользователя
	const statusDescription = useMemo(() => {
		if (!enabled) {
			return "Флаг выключен для всех пользователей";
		}
		const parts: string[] = [];
		if (segmentInclude.length > 0) {
			parts.push(`${segmentInclude.length} сегмент(ов) включено`);
		}
		if (segmentExclude.length > 0) {
			parts.push(`${segmentExclude.length} исключено`);
		}
		if (rolloutEnabled && typeof rolloutPercentage === "number") {
			parts.push(`${rolloutPercentage}% раскатка`);
		}
		if (parts.length === 0) {
			return "Флаг включен для всех пользователей";
		}
		return parts.join(" · ");
	}, [
		enabled,
		segmentInclude,
		segmentExclude,
		rolloutEnabled,
		rolloutPercentage,
	]);

	// Хелпер для обновления родительского состояния
	const updateParent = (changes: Partial<EnvState>) => {
		onChange(changes);
	};

	const handleCreateSegment = async () => {
		const value = getValues("newSegment").trim();
		if (!value) {
			return;
		}
		try {
			await onCreateSegment(value);
			setValue("newSegment", "");
		} catch {
			// Ошибка обрабатывается в родителе
		}
	};

	const handleAddSegment = (type: "include" | "exclude", segment: string) => {
		if (type === "include") {
			const updated = addSegment(segmentInclude, segment);
			setValue("segmentInclude", updated);
			updateParent({ segmentInclude: updated });
		} else {
			const updated = addSegment(segmentExclude, segment);
			setValue("segmentExclude", updated);
			updateParent({ segmentExclude: updated });
		}
	};

	const handleRemoveSegment = (
		type: "include" | "exclude",
		segment: string,
	) => {
		if (type === "include") {
			const updated = segmentInclude.filter((s) => s !== segment);
			setValue("segmentInclude", updated);
			updateParent({ segmentInclude: updated });
		} else {
			const updated = segmentExclude.filter((s) => s !== segment);
			setValue("segmentExclude", updated);
			updateParent({ segmentExclude: updated });
		}
	};

	return (
		<div className="flex flex-col gap-6 rounded-xl border bg-card p-6">
			{/* Главный переключатель */}
			<Field orientation="horizontal">
				<FieldContent>
					<div className="flex items-center gap-2">
						<FieldTitle className="text-sm font-semibold uppercase tracking-wide">
							{env.environment}
						</FieldTitle>
						<Badge variant={enabled ? "default" : "secondary"}>
							{enabled ? "Активен" : "Выключен"}
						</Badge>
					</div>
					<FieldDescription>{statusDescription}</FieldDescription>
				</FieldContent>
				<Controller
					name="enabled"
					control={control}
					render={({ field }) => (
						<div className="flex flex-col items-end gap-1">
							<Switch
								id={`${formId}-enabled`}
								checked={field.value}
								onCheckedChange={(checked) => {
									field.onChange(checked);
									updateParent({ enabled: checked });
								}}
							/>
							<span className="text-[10px] uppercase tracking-wide text-muted-foreground">
								Вкл / Выкл
							</span>
						</div>
					)}
				/>
			</Field>

			{/* Предупреждение когда флаг выключен, но есть настройки */}
			{!enabled && hasTargetingRules ? (
				<Alert variant="warning">
					<AlertTriangle />
					<AlertDescription>
						Флаг выключен — настройки таргетинга ниже сохранятся, но не будут
						применяться. Включите флаг, чтобы правила заработали.
					</AlertDescription>
				</Alert>
			) : null}

			{/* Постепенная выкатка */}
			<FieldSet>
				<Field orientation="horizontal">
					<FieldContent>
						<div className="flex items-center gap-2">
							<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
								<Percent className="h-4 w-4 text-violet-400" />
							</div>
							<div>
								<FieldTitle>Постепенная раскатка</FieldTitle>
								<FieldDescription>Процент аудитории</FieldDescription>
							</div>
						</div>
					</FieldContent>
					<Controller
						name="rolloutEnabled"
						control={control}
						render={({ field }) => (
							<Switch
								id={`${formId}-rollout`}
								checked={field.value}
								onCheckedChange={(checked) => {
									field.onChange(checked);
									updateParent({
										rolloutEnabled: checked,
										rolloutPercentage: checked ? rolloutPercentage : null,
									});
								}}
							/>
						)}
					/>
				</Field>

				{rolloutEnabled ? (
					<FieldGroup>
						<Field>
							<div className="flex items-center justify-between">
								<FieldDescription>Доля аудитории</FieldDescription>
								<Badge variant="outline" className="text-violet-400">
									{rolloutPercentage}%
								</Badge>
							</div>
							<Controller
								name="rolloutPercentage"
								control={control}
								render={({ field }) => (
									<Slider
										min={0}
										max={100}
										step={5}
										value={[field.value]}
										onValueChange={(values) => {
											const val = values[0] ?? 0;
											field.onChange(val);
											updateParent({ rolloutPercentage: val });
										}}
									/>
								)}
							/>
							<FieldDescription>
								{rolloutPercentage === 0
									? "Раскатка выключена — никто не получит флаг"
									: rolloutPercentage === 100
										? "100% — все пользователи получат флаг"
										: `≈${rolloutPercentage}% пользователей получат флаг`}
							</FieldDescription>
						</Field>
					</FieldGroup>
				) : null}
			</FieldSet>

			{/* Сегменты пользователей */}
			<FieldSet>
				<Field orientation="horizontal">
					<FieldContent>
						<div className="flex items-center gap-2">
							<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10">
								<Users className="h-4 w-4 text-sky-400" />
							</div>
							<div>
								<FieldTitle>Сегменты пользователей</FieldTitle>
								<FieldDescription>
									vip, beta, employee и другие
								</FieldDescription>
							</div>
						</div>
					</FieldContent>
					<div className="flex items-center gap-2">
						<Controller
							name="newSegment"
							control={control}
							render={({ field }) => (
								<Input
									{...field}
									placeholder="Новый сегмент..."
									className="h-8 w-36 text-xs"
								/>
							)}
						/>
						<Button
							type="button"
							size="sm"
							variant="outline"
							className="h-8"
							disabled={formState.isSubmitting}
							onClick={handleCreateSegment}
						>
							{formState.isSubmitting ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Plus className="h-3.5 w-3.5" />
							)}
						</Button>
					</div>
				</Field>

				<div className="grid gap-4 md:grid-cols-2">
					<SegmentPicker
						formId={formId}
						label="Включить"
						selected={segmentInclude}
						available={availableSegments}
						locked={segmentExclude}
						onAdd={(segment) => handleAddSegment("include", segment)}
						onRemove={(segment) => handleRemoveSegment("include", segment)}
						helper="Whitelist — только эти получат флаг"
						variant="include"
					/>
					<SegmentPicker
						formId={formId}
						label="Исключить"
						selected={segmentExclude}
						available={availableSegments}
						locked={segmentInclude}
						onAdd={(segment) => handleAddSegment("exclude", segment)}
						onRemove={(segment) => handleRemoveSegment("exclude", segment)}
						helper="Blacklist — никогда не получат"
						variant="exclude"
					/>
				</div>
			</FieldSet>

			{/* Таргетинг по телефону */}
			<FieldSet>
				<Field>
					<div className="flex items-center gap-2">
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
							<Phone className="h-4 w-4 text-amber-400" />
						</div>
						<div>
							<FieldTitle>Таргетинг по телефону</FieldTitle>
							<FieldDescription>
								Полный номер, последние цифры, код оператора
							</FieldDescription>
						</div>
					</div>
				</Field>

				<div className="grid gap-4 md:grid-cols-2">
					<PhoneTargetField
						formId={formId}
						label="Включить"
						variant="include"
						control={control}
						valueName="phoneIncludeDraft"
						modeName="phoneIncludeMode"
						value={phoneIncludeDraft}
						mode={phoneIncludeMode}
						onValueChange={(val) => updateParent({ phoneIncludeDraft: val })}
						onModeChange={(mode) => updateParent({ phoneIncludeMode: mode })}
					/>
					<PhoneTargetField
						formId={formId}
						label="Исключить"
						variant="exclude"
						control={control}
						valueName="phoneExcludeDraft"
						modeName="phoneExcludeMode"
						value={phoneExcludeDraft}
						mode={phoneExcludeMode}
						onValueChange={(val) => updateParent({ phoneExcludeDraft: val })}
						onModeChange={(mode) => updateParent({ phoneExcludeMode: mode })}
					/>
				</div>
			</FieldSet>

			{/* Таргетинг по дате рождения */}
			<FieldSet>
				<Field>
					<div className="flex items-center gap-2">
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10">
							<Cake className="h-4 w-4 text-rose-400" />
						</div>
						<div>
							<FieldTitle>Таргетинг по дате рождения</FieldTitle>
							<FieldDescription>
								Точная дата в формате ДД.ММ.ГГГГ
							</FieldDescription>
						</div>
					</div>
				</Field>

				<div className="grid gap-4 md:grid-cols-2">
					<BirthdateTargetField
						formId={formId}
						label="Включить"
						variant="include"
						control={control}
						name="birthdateIncludeDraft"
						value={birthdateIncludeDraft}
						onChange={(val) => updateParent({ birthdateIncludeDraft: val })}
					/>
					<BirthdateTargetField
						formId={formId}
						label="Исключить"
						variant="exclude"
						control={control}
						name="birthdateExcludeDraft"
						value={birthdateExcludeDraft}
						onChange={(val) => updateParent({ birthdateExcludeDraft: val })}
					/>
				</div>
			</FieldSet>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Компонент выбора сегментов
// ─────────────────────────────────────────────────────────────────────────────

type SegmentPickerProps = {
	formId: string;
	label: string;
	selected: string[];
	available: string[];
	locked?: string[];
	onAdd: (segment: string) => void;
	onRemove: (segment: string) => void;
	helper?: string;
	variant?: "include" | "exclude";
};

function SegmentPicker({
	formId,
	label,
	selected,
	available,
	locked = [],
	onAdd,
	onRemove,
	helper,
	variant = "include",
}: SegmentPickerProps) {
	const { control, setValue } = useForm<{ selection: string }>({
		defaultValues: { selection: "" },
	});

	const options = useMemo(
		() =>
			available.filter(
				(segment) => !selected.includes(segment) && !locked.includes(segment),
			),
		[available, locked, selected],
	);

	const isInclude = variant === "include";
	const badgeVariant = isInclude ? "default" : "destructive";

	return (
		<FieldGroup className="rounded-lg border bg-muted/30 p-3">
			<Field>
				<FieldTitle
					className={isInclude ? "text-emerald-400" : "text-rose-400"}
				>
					{label}
					{selected.length > 0 && (
						<Badge variant="secondary" className="ml-2">
							{selected.length}
						</Badge>
					)}
				</FieldTitle>
				<div className="flex min-h-[42px] flex-wrap gap-1.5 rounded-md border bg-background p-2">
					{selected.length === 0 ? (
						<span className="text-xs text-muted-foreground">Не выбрано</span>
					) : (
						selected.map((segment) => (
							<Badge key={segment} variant={badgeVariant} className="gap-1">
								{segment}
								<button
									type="button"
									className="ml-0.5 rounded hover:bg-background/20"
									onClick={() => onRemove(segment)}
								>
									<X className="h-3 w-3" />
								</button>
							</Badge>
						))
					)}
				</div>
			</Field>
			<Field>
				<Controller
					name="selection"
					control={control}
					render={({ field }) => (
						<Select
							value={field.value}
							onValueChange={(value) => {
								setValue("selection", "");
								onAdd(value);
							}}
							disabled={options.length === 0}
						>
							<SelectTrigger
								id={`${formId}-segment-${variant}`}
								className="h-8 text-xs"
							>
								<SelectValue placeholder="Добавить сегмент..." />
							</SelectTrigger>
							<SelectContent>
								{options.map((segment) => (
									<SelectItem key={segment} value={segment} className="text-xs">
										{segment}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				/>
				{helper ? <FieldDescription>{helper}</FieldDescription> : null}
			</Field>
		</FieldGroup>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Компонент ввода телефона
// ─────────────────────────────────────────────────────────────────────────────

type PhoneTargetFieldProps = {
	formId: string;
	label: string;
	variant: "include" | "exclude";
	control: ReturnType<typeof useForm<EnvFormValues>>["control"];
	valueName: "phoneIncludeDraft" | "phoneExcludeDraft";
	modeName: "phoneIncludeMode" | "phoneExcludeMode";
	value: string;
	mode: PhoneMatchMode;
	onValueChange: (value: string) => void;
	onModeChange: (mode: PhoneMatchMode) => void;
};

function PhoneTargetField({
	formId,
	label,
	variant,
	control,
	valueName,
	modeName,
	value,
	mode,
	onValueChange,
	onModeChange,
}: PhoneTargetFieldProps) {
	const derivedSegments = useMemo(
		() => derivePhoneSegments(value, mode),
		[value, mode],
	);
	const modes: PhoneMatchMode[] = ["auto", "full", "last2", "last4", "prefix3"];
	const isInclude = variant === "include";

	return (
		<FieldGroup className="rounded-lg border bg-muted/30 p-3">
			<Field orientation="horizontal">
				<FieldTitle
					className={isInclude ? "text-emerald-400" : "text-rose-400"}
				>
					{label}
				</FieldTitle>
				<Controller
					name={modeName}
					control={control}
					render={({ field }) => (
						<Select
							value={field.value}
							onValueChange={(v) => {
								field.onChange(v);
								onModeChange(v as PhoneMatchMode);
							}}
						>
							<SelectTrigger className="h-7 w-[140px] text-[11px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{modes.map((m) => (
									<SelectItem key={m} value={m} className="text-xs">
										{phoneMatchModeLabels[m]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				/>
			</Field>

			<Field>
				<Controller
					name={valueName}
					control={control}
					render={({ field }) => (
						<Input
							{...field}
							id={`${formId}-${valueName}`}
							ref={withMask("+7 (999) 999-99-99", {
								placeholder: "_",
								showMaskOnHover: true,
								showMaskOnFocus: true,
							})}
							onChange={(e) => {
								field.onChange(e);
								onValueChange(e.target.value);
							}}
							placeholder="+7 (___) ___-__-__"
							className="h-9 text-sm font-mono"
						/>
					)}
				/>
			</Field>

			{derivedSegments.length > 0 ? (
				<Field>
					<FieldDescription className="flex items-center gap-1">
						<Hash className="h-3 w-3" />
						Сегменты:
					</FieldDescription>
					<div className="flex flex-wrap gap-1">
						{derivedSegments.map((segment) => (
							<Badge
								key={segment}
								variant="outline"
								className={
									isInclude
										? "border-emerald-500/20 text-emerald-300"
										: "border-rose-500/20 text-rose-300"
								}
								title={segment}
							>
								{getSegmentDescription(segment)}
							</Badge>
						))}
					</div>
				</Field>
			) : value ? (
				<FieldDescription>Введите больше цифр...</FieldDescription>
			) : null}
		</FieldGroup>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Компонент ввода даты рождения
// ─────────────────────────────────────────────────────────────────────────────

type BirthdateTargetFieldProps = {
	formId: string;
	label: string;
	variant: "include" | "exclude";
	control: ReturnType<typeof useForm<EnvFormValues>>["control"];
	name: "birthdateIncludeDraft" | "birthdateExcludeDraft";
	value: string;
	onChange: (value: string) => void;
};

function BirthdateTargetField({
	formId,
	label,
	variant,
	control,
	name,
	value,
	onChange,
}: BirthdateTargetFieldProps) {
	// Конвертируем ISO в RU формат для отображения
	const displayValue = useMemo(() => formatToRuDate(value), [value]);

	const derivedSegments = useMemo(
		() => deriveBirthdateSegments(value),
		[value],
	);
	const isInclude = variant === "include";

	return (
		<FieldGroup className="rounded-lg border bg-muted/30 p-3">
			<Field>
				<FieldTitle
					className={isInclude ? "text-emerald-400" : "text-rose-400"}
				>
					{label}
				</FieldTitle>
				<Controller
					name={name}
					control={control}
					render={({ field }) => (
						<Input
							id={`${formId}-${name}`}
							value={displayValue}
							ref={withMask("99.99.9999", {
								placeholder: "_",
								showMaskOnHover: true,
								showMaskOnFocus: true,
							})}
							onChange={(e) => {
								const ruDate = e.target.value;
								// Конвертируем в ISO формат для хранения
								const isoDate = parseRuDate(ruDate);
								if (isoDate) {
									field.onChange(isoDate);
									onChange(isoDate);
								} else {
									// Храним как есть если не удалось распарсить
									field.onChange(ruDate);
									onChange(ruDate);
								}
							}}
							placeholder="ДД.ММ.ГГГГ"
							className="h-9 text-sm font-mono"
						/>
					)}
				/>
				<FieldDescription>Формат: ДД.ММ.ГГГГ</FieldDescription>
			</Field>

			{derivedSegments.length > 0 ? (
				<Field>
					<FieldDescription className="flex items-center gap-1">
						<Hash className="h-3 w-3" />
						Сегмент:
					</FieldDescription>
					<div className="flex flex-wrap gap-1">
						{derivedSegments.map((segment) => (
							<Badge
								key={segment}
								variant="outline"
								className={
									isInclude
										? "border-emerald-500/20 text-emerald-300"
										: "border-rose-500/20 text-rose-300"
								}
								title={segment}
							>
								{getSegmentDescription(segment)}
							</Badge>
						))}
					</div>
				</Field>
			) : null}
		</FieldGroup>
	);
}
