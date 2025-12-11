import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
import { type CreateFlagPayload, createFlag } from "@/lib/api";
import { environmentsOrder } from "@/lib/flag-utils";

const createFlagFormSchema = z.object({
	key: z.string().min(1, "Укажите ключ флага"),
	name: z.string().min(1, "Укажите имя флага"),
	description: z.string().optional(),
	type: z.enum(["BOOLEAN", "MULTIVARIANT"]),
});

type CreateFlagForm = z.infer<typeof createFlagFormSchema>;

const defaultEnvironments = environmentsOrder.map((env) => ({
	environment: env,
	enabled: false,
	rolloutPercentage: null,
}));

export const Route = createFileRoute("/create")({
	component: () => <CreateFlagPage />,
});

function CreateFlagPage() {
        const navigate = useNavigate();
        const {
                register,
                handleSubmit,
                control,
                setError,
                clearErrors,
                formState: { errors, isSubmitting },
        } = useForm<CreateFlagForm>({
                resolver: zodResolver(createFlagFormSchema),
                defaultValues: {
			key: "",
			name: "",
			description: "",
			type: "BOOLEAN",
		},
		mode: "onChange",
	});

        const onSubmit = handleSubmit(async (value) => {
                clearErrors("root");
                try {
                        const payload: CreateFlagPayload = {
                                key: value.key.trim(),
				name: value.name.trim(),
				description: value.description?.trim() || undefined,
				type: value.type,
				environments: defaultEnvironments,
			};
			await createFlag(payload);
                        toast.success("Флаг создан", {
                                description: `Флаг "${value.name}" успешно создан`,
                        });
                        navigate({ to: "/" });
                } catch (err) {
                        const message =
                                err instanceof Error ? err.message : "Не удалось создать флаг";
                        toast.error("Ошибка создания", { description: message });
                        setError("root", { type: "server", message });
                }
        });

	return (
		<div className="mx-auto max-w-3xl space-y-6 px-6 py-10">
			<div className="space-y-2">
				<p className="text-sm uppercase tracking-wide text-muted-foreground">
					Создание
				</p>
				<h1 className="text-3xl font-semibold">Новый флаг</h1>
				<p className="text-sm text-muted-foreground">
					Заполните ключ, имя и описание. Все окружения создадутся в выключенном
					состоянии.
				</p>
			</div>

                        {errors.root?.message ? (
                                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive">
                                        {errors.root.message}
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
					<Input {...register("name")} placeholder="Отображаемое имя флага" />
					{errors.name ? (
						<p className="text-xs text-destructive">{errors.name.message}</p>
					) : null}
				</div>
				<div className="space-y-2">
					<Label>Описание</Label>
					<Textarea
						{...register("description")}
						placeholder="Что делает этот флаг и зачем он нужен"
					/>
				</div>
				<div className="space-y-2">
					<Label>Тип</Label>
					<Controller
						name="type"
						control={control}
						render={({ field }) => (
							<Select value={field.value} onValueChange={field.onChange}>
								<SelectTrigger className="w-full">
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
				<div className="flex justify-between gap-3 pt-4">
                                        <Button variant="ghost" onClick={() => navigate({ to: "/" })}>
                                                Отменить
                                        </Button>
                                        <Button type="submit" disabled={isSubmitting}>
                                                {isSubmitting ? (
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
