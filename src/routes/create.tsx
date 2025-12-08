import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type CreateFlagPayload, createFlag } from "@/lib/api";
import { environmentsOrder, parseTags } from "@/lib/flag-utils";

const createFlagFormSchema = z.object({
	key: z.string().min(1, "Укажите ключ"),
	name: z.string().min(1, "Укажите имя"),
	description: z.string().optional(),
	tagsInput: z.string().optional(),
	type: z.enum(["BOOLEAN", "MULTIVARIANT"]),
});

type CreateFlagForm = z.infer<typeof createFlagFormSchema>;

const defaultEnvironments = environmentsOrder.map((env) => ({
	environment: env,
	enabled: false,
	rolloutPercentage: null,
	forceEnabled: null,
	forceDisabled: null,
}));

export const Route = createFileRoute("/create")({
	component: () => <CreateFlagPage />,
});

function CreateFlagPage() {
	const navigate = useNavigate();
	const [error, setError] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<CreateFlagForm>({
		resolver: zodResolver(createFlagFormSchema),
		defaultValues: {
			key: "",
			name: "",
			description: "",
			tagsInput: "",
			type: "BOOLEAN",
		},
		mode: "onChange",
	});

	const onSubmit = handleSubmit(async (value) => {
		setCreating(true);
		setError(null);
		try {
			const payload: CreateFlagPayload = {
				key: value.key.trim(),
				name: value.name.trim(),
				description: value.description?.trim() || undefined,
				tags: parseTags(value.tagsInput ?? ""),
				type: value.type,
				environments: defaultEnvironments,
			};
			await createFlag(payload);
			navigate({ to: "/" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Не удалось создать флаг");
		} finally {
			setCreating(false);
		}
	});

	return (
		<div className="mx-auto max-w-3xl space-y-6 px-6 py-10">
			<div className="space-y-2">
				<p className="text-sm uppercase tracking-wide text-muted-foreground">
					Создание
				</p>
				<h1 className="text-3xl font-semibold">Создать новый флаг</h1>
				<p className="text-sm text-muted-foreground">
					Заполните базовые поля, чтобы добавить флаг и сразу перейти к
					настройкам.
				</p>
			</div>

			{error ? (
				<div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive">
					{error}
				</div>
			) : null}

			<form
				className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm"
				onSubmit={onSubmit}
			>
				<div className="space-y-2">
					<Label>Ключ</Label>
					<Input {...register("key")} placeholder="checkout-new-flow" />
					{errors.key ? (
						<p className="text-xs text-destructive">{errors.key.message}</p>
					) : null}
				</div>
				<div className="space-y-2">
					<Label>Название</Label>
					<Input {...register("name")} placeholder="Эксперимент на чекауте" />
					{errors.name ? (
						<p className="text-xs text-destructive">{errors.name.message}</p>
					) : null}
				</div>
				<div className="space-y-2">
					<Label>Описание</Label>
					<Textarea
						{...register("description")}
						placeholder="Уточните цель флага, окружения и ожидаемое поведение."
					/>
				</div>
				<div className="space-y-2">
					<Label>Теги</Label>
					<Input {...register("tagsInput")} placeholder="growth, billing" />
					<p className="text-xs text-muted-foreground">Через запятую</p>
				</div>
				<div className="space-y-2">
					<Label>Тип</Label>
					<select
						className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
						{...register("type")}
					>
						<option value="BOOLEAN">BOOLEAN</option>
						<option value="MULTIVARIANT">MULTIVARIANT</option>
					</select>
				</div>
				<div className="flex justify-between gap-3 pt-4">
					<Button variant="ghost" onClick={() => navigate({ to: "/" })}>
						Отмена
					</Button>
					<Button type="submit" disabled={creating}>
						{creating ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Plus className="h-4 w-4" />
						)}
						Создать
					</Button>
				</div>
			</form>
		</div>
	);
}
