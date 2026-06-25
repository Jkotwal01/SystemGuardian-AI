import { create } from "zustand";
import { IncidentRead, IncidentStatus } from "@/lib/types";
import { api } from "@/lib/api-client";

interface IncidentStore {
  incidents: IncidentRead[];
  loading: boolean;
  error: string | null;
  fetchIncidents: () => Promise<void>;
  updateIncidentStatus: (id: string, status: IncidentStatus, notes?: string) => Promise<void>;
  addOrUpdateIncident: (incident: IncidentRead) => void;
}

export const useIncidentStore = create<IncidentStore>((set, get) => ({
  incidents: [],
  loading: false,
  error: null,

  fetchIncidents: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.incidents.list();
      set({ incidents: response.items, loading: false });
    } catch (error: any) {
      set({ error: error.message || "Failed to fetch incidents", loading: false });
    }
  },

  updateIncidentStatus: async (id: string, status: IncidentStatus, notes?: string) => {
    try {
      const payload: any = { status };
      if (notes) payload.resolution_notes = notes;
      
      const updatedIncident = await api.incidents.updateStatus(id, payload);
      get().addOrUpdateIncident(updatedIncident);
    } catch (error: any) {
      console.error("Failed to update incident", error);
    }
  },

  addOrUpdateIncident: (incident: IncidentRead) => {
    set((state) => {
      const index = state.incidents.findIndex((i) => i.id === incident.id);
      if (index >= 0) {
        const newIncidents = [...state.incidents];
        // If resolved/dismissed, we might want to remove it or keep it depending on UX.
        // For an active incidents list, we usually remove resolved ones.
        if (incident.status === "resolved" || incident.status === "dismissed") {
            newIncidents.splice(index, 1);
        } else {
            newIncidents[index] = incident;
        }
        return { incidents: newIncidents };
      }
      
      if (incident.status !== "resolved" && incident.status !== "dismissed") {
        return { incidents: [incident, ...state.incidents] };
      }
      return state;
    });
  },
}));
