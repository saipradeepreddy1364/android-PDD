import { WorkflowRecommender, RecommendedStep } from "../src/lib/WorkflowRecommender";

async function testRecs() {
  console.log("--- Testing Recommendations for IMP-003-S1 (Ceramic Coping) ---");
  const recs = await WorkflowRecommender.recommendNextSteps(
    "IMP-003",
    "IMP-003-S1",
    { diagnosis: "Ceramic restoration for tooth 36" }
  );

  recs.forEach((r: RecommendedStep) => {
    console.log(`- ${r.name} (Score: ${r.score.toFixed(2)})`);
    console.log(`  Reasons: ${r.reasons.join(", ")}`);
  });

  console.log("\n--- Testing Recommendations for CPD-001-S1 (Cast Pouring) ---");
  const recs2 = await WorkflowRecommender.recommendNextSteps(
    "CPD-001",
    "CPD-001-S1",
    { diagnosis: "Missing molar needing partial denture" }
  );

  recs2.forEach((r: RecommendedStep) => {
    console.log(`- ${r.name} (Score: ${r.score.toFixed(2)})`);
    console.log(`  Reasons: ${r.reasons.join(", ")}`);
  });
}

testRecs();
