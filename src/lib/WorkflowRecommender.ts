import { supabase } from "./supabase";
import diasWorkflow from "../data/dias_lab_workflow.json";

export interface RecommendedStep {
  id: string;
  name: string;
  component: string;
  order: number;
  score: number;
  reasons: string[];
}

export class WorkflowRecommender {
  private static WEIGHT_CONTENT = 0.7;
  private static WEIGHT_COLLABORATIVE = 0.3;

  /**
   * Recommends next steps based on the current step selection and case context.
   */
  static async recommendNextSteps(
    procedureId: string,
    currentStepId: string,
    caseContext: { diagnosis: string; patientId?: string }
  ): Promise<RecommendedStep[]> {
    const procedure = diasWorkflow.procedures.find((p: any) => p.id === procedureId);
    if (!procedure) return [];

    const currentStep = procedure.steps.find((s: any) => s.id === currentStepId);
    if (!currentStep) return [];

    // 1. Candidate Generation (from JSON next_steps)
    const candidates = procedure.steps.filter((s: any) => 
      currentStep.next_steps.includes(s.id)
    );

    // If no explicit next steps in JSON, consider all steps with higher order as potential candidates
    if (candidates.length === 0) {
      candidates.push(...procedure.steps.filter((s: any) => s.order > currentStep.order));
    }

    const recommendations: RecommendedStep[] = [];

    // 2. Scoring
    for (const step of candidates) {
      const cbScore = this.calculateContentScore(step, caseContext.diagnosis);
      const cfScore = await this.calculateCollaborativeScore(step, procedureId);

      const totalScore = (cbScore * this.WEIGHT_CONTENT) + (cfScore * this.WEIGHT_COLLABORATIVE);

      const reasons: string[] = [];
      if (cbScore > 0.5) reasons.push("Strong match with patient diagnosis");
      if (cfScore > 0.5) reasons.push("Frequently chosen in similar workflows");
      if (step.is_final) reasons.push("Completes this workflow category");

      recommendations.push({
        id: step.id,
        name: step.name,
        component: step.component,
        order: step.order,
        score: totalScore,
        reasons: reasons,
      });
    }

    // 3. Re-ranking (Sort by score descending)
    return recommendations.sort((a, b) => b.score - a.score);
  }

  /**
   * Simple Jaccard similarity/Keyword matching
   */
  private static calculateContentScore(step: any, diagnosis: string): number {
    if (!diagnosis) return 0.5; // Neutral if no diagnosis

    const stepText = `${step.name} ${step.component} ${step.brand}`.toLowerCase();
    const dxTerms = diagnosis.toLowerCase().split(/\s+/);
    
    let matches = 0;
    dxTerms.forEach(term => {
      if (term.length > 3 && stepText.includes(term)) matches++;
    });

    return Math.min(1, matches / (dxTerms.length || 1) + 0.2); // Base score of 0.2 if part of workflow
  }

  /**
   * Simulated Collaborative Filtering
   * In a real system, this would query a 'workflow_transitions' table or aggregate 'cases'
   */
  private static async calculateCollaborativeScore(step: any, procedureId: string): Promise<number> {
    try {
      // Mocking collaborative data based on common dental patterns
      // In production, we would use: 
      // await supabase.from('case_steps').select('count()').eq('step_id', step.id)
      
      const commonPatterns: Record<string, number> = {
        "IMP-": 0.8, // Implants are common
        "CPD-": 0.6, // Dentures are frequent
        "TC-": 0.4,  // Coping is niche
      };

      const prefix = step.id.split('-')[0] + '-';
      return commonPatterns[prefix] || 0.5;
    } catch (e) {
      return 0.5;
    }
  }
}
