import { create } from "zustand";
import { z } from "zod";

import { FeatureEnvironmentSchema } from "@/lib/api";

const confirmationActionSchema = z
        .union([
                z.object({
                        type: z.literal("toggle"),
                        flagKey: z.string(),
                        environment: FeatureEnvironmentSchema,
                        enabled: z.boolean(),
                }),
                z.object({
                        type: z.literal("delete"),
                        flagKey: z.string(),
                }),
        ])
        .nullable();

export type ConfirmationAction = z.infer<typeof confirmationActionSchema>;

const dashboardActionStateSchema = z.object({
        actionError: z.string().nullable(),
        togglingKey: z.string().nullable(),
        deletingKey: z.string().nullable(),
        confirmationAction: confirmationActionSchema,
        confirmationInput: z.string(),
        refreshing: z.boolean(),
});

const initialState: z.infer<typeof dashboardActionStateSchema> = {
        actionError: null,
        togglingKey: null,
        deletingKey: null,
        confirmationAction: null,
        confirmationInput: "",
        refreshing: false,
};

type DashboardActionState = z.infer<typeof dashboardActionStateSchema> & {
        setActionError: (message: string | null) => void;
        setTogglingKey: (key: string | null) => void;
        setDeletingKey: (key: string | null) => void;
        setRefreshing: (value: boolean) => void;
        setConfirmationAction: (action: ConfirmationAction) => void;
        setConfirmationInput: (value: string) => void;
        resetConfirmation: () => void;
        resetAll: () => void;
};

export const useDashboardActionsStore = create<DashboardActionState>((set) => ({
        ...initialState,
        setActionError: (message) => set({ actionError: message }),
        setTogglingKey: (key) => set({ togglingKey: key }),
        setDeletingKey: (key) => set({ deletingKey: key }),
        setRefreshing: (value) => set({ refreshing: value }),
        setConfirmationAction: (action) => set({ confirmationAction: action }),
        setConfirmationInput: (value) => set({ confirmationInput: value }),
        resetConfirmation: () =>
                set({
                        confirmationAction: initialState.confirmationAction,
                        confirmationInput: initialState.confirmationInput,
                        deletingKey: initialState.deletingKey,
                        togglingKey: initialState.togglingKey,
                }),
        resetAll: () => set(initialState),
}));
