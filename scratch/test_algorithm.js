// Using require for node execution
const diasWorkflow = require("../src/data/dias_lab_workflow.json");

const WorkflowRecommender = {
  WEIGHT_CONTENT: 0.7,
  WEIGHT_COLLABORATIVE: 0.3,

  async recommendNextSteps(procedureId, currentStepId, caseContext) {
    const procedure = diasWorkflow.procedures.find((p) => p.id === procedureId);
    if (!procedure) return [];

    const currentStep = procedure.steps.find((s) => s.id === currentStepId);
    if (!currentStep) return [];

    const candidates = procedure.steps.filter((s) => 
      currentStep.next_steps.includes(s.id)
    );

    if (candidates.length === 0) {
      candidates.push(...procedure.steps.filter((s) => s.order > currentStep.order));
    }

    const recommendations = [];

    for (const step of candidates) {
      const cbScore = this.calculateContentScore(step, caseContext.diagnosis);
      const cfScore = await this.calculateCollaborativeScore(step, procedureId);

      const totalScore = (cbScore * this.WEIGHT_CONTENT) + (cfScore * this.WEIGHT_COLLABORATIVE);

      const reasons = [];
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

    return recommendations.sort((a, b) => b.score - a.score);
  },

  calculateContentScore(step, diagnosis) {
    if (!diagnosis) return 0.5;
    const stepText = `${step.name} ${step.component}`.toLowerCase();
    const dxTerms = diagnosis.toLowerCase().split(/\s+/);
    let matches = 0;
    dxTerms.forEach(term => {
      if (term.length > 3 && stepText.includes(term)) matches++;
    });
    return Math.min(1, matches / (dxTerms.length || 1) + 0.2);
  },

  async calculateCollaborativeScore(step, procedureId) {
    const commonPatterns = { "IMP-": 0.8, "CPD-": 0.6, "TC-": 0.4 };
    const prefix = step.id.split('-')[0] + '-';
    return commonPatterns[prefix] || 0.5;
  }
};

async function testRecs() {
  console.log("--- Testing Recommendations for IMP-003-S1 (Ceramic Coping) ---");
  const recs = await WorkflowRecommender.recommendNextSteps(
    "IMP-003",
    "IMP-003-S1",
    { diagnosis: "Ceramic restoration for tooth 36" }
  );

  recs.forEach(r => {
    console.log(`- ${r.name} (Score: ${r.score.toFixed(2)})`);
    console.log(`  Reasons: ${r.reasons.join(", ")}`);
  });

  console.log("\n--- Testing Recommendations for CPD-001-S1 (Cast Pouring) ---");
  const recs2 = await WorkflowRecommender.recommendNextSteps(
    "CPD-001",
    "CPD-001-S1",
    { diagnosis: "Missing molar needing partial denture" }
  );

  recs2.forEach(r => {
    console.log(`- ${r.name} (Score: ${r.score.toFixed(2)})`);
    console.log(`  Reasons: ${r.reasons.join(", ")}`);
  });
}

testRecs();
