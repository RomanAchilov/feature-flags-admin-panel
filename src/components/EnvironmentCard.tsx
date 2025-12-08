import type React from "react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import type { EnvState } from "@/lib/flag-utils";
import { addSegment } from "@/lib/flag-utils";

type EnvironmentCardProps = {
	env: EnvState;
	onChange: (changes: Partial<EnvState>) => void;
};

export function EnvironmentCard({ env, onChange }: EnvironmentCardProps) {
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
						<option value="employee">Сотрудник</option>
						<option value="beta">Бета</option>
						<option value="premium">Премиум</option>
						<option value="new_customer">Новый клиент</option>
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
						<option value="non_employee">Не сотрудник</option>
						<option value="old_customer">Постоянный клиент</option>
						<option value="beta_tester">Бета-тестер</option>
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
						Можно указать номер целиком или только последние цифры.
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
						Можно исключать по полному номеру и по последним 4 цифрам.
					</p>
				</div>
			</div>
		</div>
	);
}

type TagInputProps = {
	id: string;
	label: string;
	values: string[];
	inputValue: string;
	onInputChange: (value: string) => void;
	onAdd: (value: string) => void;
	onRemove: (value: string) => void;
	placeholder?: string;
	helper?: string;
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
}: TagInputProps) {
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
