import { Loader2, Plus, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
	addSegment,
	derivePhoneSegments,
	type EnvState,
} from "@/lib/flag-utils";

type EnvironmentCardProps = {
	env: EnvState;
	availableSegments: string[];
	onChange: (changes: Partial<EnvState>) => void;
	onCreateSegment: (name: string) => Promise<string>;
};

export function EnvironmentCard({
	env,
	availableSegments,
	onChange,
	onCreateSegment,
}: EnvironmentCardProps) {
	const phoneIncludeId = useId();
	const phoneExcludeId = useId();

	const [newSegment, setNewSegment] = useState("");
	const [creatingSegment, setCreatingSegment] = useState(false);
	const [segmentError, setSegmentError] = useState<string | null>(null);

	const handleCreateSegment = async () => {
		const value = newSegment.trim();
		if (!value) {
			setSegmentError("Введите название сегмента");
			return;
		}
		setSegmentError(null);
		setCreatingSegment(true);
		try {
			await onCreateSegment(value);
			setNewSegment("");
		} catch (error) {
			setSegmentError(
				error instanceof Error ? error.message : "Не удалось создать сегмент",
			);
		} finally {
			setCreatingSegment(false);
		}
	};

	return (
		<div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
			<div className="flex items-center justify-between gap-3">
				<div>
					<p className="text-xs uppercase tracking-wide text-muted-foreground">
						{env.environment}
					</p>
					<p className="text-sm text-muted-foreground">
						{env.enabled ? "Флаг включен" : "Флаг выключен"}{" "}
						{env.rolloutEnabled && typeof env.rolloutPercentage === "number"
							? `(выкатка ${env.rolloutPercentage}%)`
							: ""}
					</p>
				</div>
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<span>Активно</span>
					<Switch
						checked={env.enabled}
						onCheckedChange={(checked) => onChange({ enabled: checked })}
					/>
				</div>
			</div>

			<div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
				<span>Постепенная выкатка по проценту</span>
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
						<span>Доля аудитории</span>
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

			<div className="space-y-3 rounded-md border p-3">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div>
						<p className="text-sm font-medium">Сегменты</p>
						<p className="text-xs text-muted-foreground">
							Выбирайте готовые сегменты, свободный ввод отключён.
						</p>
					</div>
					<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
						<Input
							value={newSegment}
							onChange={(event) => setNewSegment(event.target.value)}
							placeholder="vip, beta, employee"
							className="text-sm sm:w-48"
						/>
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={creatingSegment}
							onClick={handleCreateSegment}
						>
							{creatingSegment ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<Plus className="mr-2 h-4 w-4" />
							)}
							Создать новый сегмент
						</Button>
					</div>
				</div>
				<div className="grid gap-3 md:grid-cols-2">
					<SegmentPicker
						label="Включить для сегментов"
						selected={env.segmentInclude}
						available={availableSegments}
						locked={env.segmentExclude}
						onAdd={(segment) =>
							onChange({
								segmentInclude: addSegment(env.segmentInclude, segment),
							})
						}
						onRemove={(segment) =>
							onChange({
								segmentInclude: env.segmentInclude.filter(
									(item) => item !== segment,
								),
							})
						}
						helper="Пользователи из выбранных сегментов попадут под действие флага."
					/>
					<SegmentPicker
						label="Исключить сегменты"
						selected={env.segmentExclude}
						available={availableSegments}
						locked={env.segmentInclude}
						onAdd={(segment) =>
							onChange({
								segmentExclude: addSegment(env.segmentExclude, segment),
							})
						}
						onRemove={(segment) =>
							onChange({
								segmentExclude: env.segmentExclude.filter(
									(item) => item !== segment,
								),
							})
						}
						helper="Эти сегменты будут исключены даже при процентной выкаты."
					/>
				</div>
				{segmentError ? (
					<p className="text-xs text-destructive">{segmentError}</p>
				) : null}
			</div>

			<div className="grid gap-3 md:grid-cols-2">
				<PhoneTargetInput
					id={phoneIncludeId}
					label="Телефон (включить)"
					value={env.phoneIncludeDraft}
					onChange={(value) => onChange({ phoneIncludeDraft: value })}
					helper="Введите полный номер, только последние 2 цифры, либо первые 3 цифры после 7."
				/>
				<PhoneTargetInput
					id={phoneExcludeId}
					label="Телефон (исключить)"
					value={env.phoneExcludeDraft}
					onChange={(value) => onChange({ phoneExcludeDraft: value })}
					helper="Совпадение по номеру, последним двум цифрам или префиксу отключит флаг."
				/>
			</div>
		</div>
	);
}

type SegmentPickerProps = {
	label: string;
	selected: string[];
	available: string[];
	locked?: string[];
	onAdd: (segment: string) => void;
	onRemove: (segment: string) => void;
	helper?: string;
};

function SegmentPicker({
	label,
	selected,
	available,
	locked = [],
	onAdd,
	onRemove,
	helper,
}: SegmentPickerProps) {
	const [selection, setSelection] = useState("");
	const options = useMemo(
		() =>
			available.filter(
				(segment) => !selected.includes(segment) && !locked.includes(segment),
			),
		[available, locked, selected],
	);

	return (
		<div className="space-y-2">
			<Label className="text-xs font-medium">{label}</Label>
			<div className="flex min-h-[40px] flex-wrap gap-2 rounded-md border bg-muted/30 p-2">
				{selected.length === 0 ? (
					<span className="text-[11px] text-muted-foreground">
						Нет выбранных сегментов
					</span>
				) : (
					selected.map((segment) => (
						<span
							key={segment}
							className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/40 px-2 py-1 text-[11px] font-medium"
						>
							{segment}
							<button
								type="button"
								className="text-muted-foreground hover:text-destructive"
								onClick={() => onRemove(segment)}
							>
								<X className="h-3 w-3" />
							</button>
						</span>
					))
				)}
			</div>
			<Select
				value={selection}
				onValueChange={(value) => {
					setSelection("");
					onAdd(value);
				}}
				disabled={options.length === 0}
			>
				<SelectTrigger className="w-full text-sm">
					<SelectValue placeholder="Выберите сегмент" />
				</SelectTrigger>
				<SelectContent>
					{options.map((segment) => (
						<SelectItem key={segment} value={segment}>
							{segment}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{helper ? (
				<p className="text-[11px] text-muted-foreground">{helper}</p>
			) : null}
		</div>
	);
}

type PhoneTargetInputProps = {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	helper: string;
};

function PhoneTargetInput({
	id,
	label,
	value,
	onChange,
	helper,
}: PhoneTargetInputProps) {
	const derivedSegments = useMemo(() => derivePhoneSegments(value), [value]);

	return (
		<div className="space-y-2">
			<Label htmlFor={id} className="text-xs font-medium">
				{label}
			</Label>
			<Input
				id={id}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder="+7 999 123 45 67 или 67"
				className="text-sm"
			/>
			<p className="text-[11px] text-muted-foreground">{helper}</p>
			{derivedSegments.length > 0 ? (
				<div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
					{derivedSegments.map((segment) => (
						<span
							key={segment}
							className="rounded-md bg-muted px-2 py-1 font-medium"
						>
							{segment}
						</span>
					))}
				</div>
			) : null}
		</div>
	);
}
