import { fetchProcedures, fetchWorkflow } from "./backendApi";
import type { WorkflowStep } from "./backendApi";

export interface RecommendedStep {
  stepNumber: number;
  currentStep: string;
  nextStep: string;
  currentDescription: string;
  nextDescription: string;
  confidence: number;
  source: string;
}

export class WorkflowRecommender {
  /**
   * Fetches all available procedure names and their subtypes from the backend.
   * Returns a map of { procedureName: string[] }.
   */
  static async getProceduresMap(): Promise<Record<string, string[]>> {
    return fetchProcedures();
  }

  /**
   * Fetches the complete ordered workflow for a given procedure + subtype.
   * Returns an array of step transition objects.
   */
  static async getWorkflow(
    procedure: string,
    subtype: string
  ): Promise<RecommendedStep[]> {
    const result = await fetchWorkflow(procedure, subtype);
    return result.workflow.map((s: WorkflowStep) => ({
      stepNumber: s.step_number,
      currentStep: s.current_step,
      nextStep: s.next_step,
      currentDescription: s.current_description,
      nextDescription: s.next_description,
      confidence: s.confidence,
      source: s.source,
    }));
  }

  /**
   * Fetches only the top recommended next step for a given procedure, subtype,
   * and current step name. Finds the matching step entry in the workflow.
   */
  static async recommendNextStep(
    procedure: string,
    subtype: string,
    currentStepName: string
  ): Promise<RecommendedStep | null> {
    const steps = await this.getWorkflow(procedure, subtype);
    const match = steps.find(
      (s) => s.currentStep.toLowerCase() === currentStepName.toLowerCase()
    );
    return match ?? null;
  }
}
