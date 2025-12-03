// Testing for generateChatCompletion_with_resilience (Enhanced)
import { generateChatCompletion } from '../src/lib/openai';

// Manual tester for generateChatCompletion
async function main() {
  const query = "What documents are needed for the Scan workflow?";
  const context = `
Company Name: ExampleCorp
Industry: Technology
Country: UK
Description: ExampleCorp is a leading provider of cloud solutions for enterprise clients.
Uploaded Documents:
- HRIS_Report.pdf
- Org_Structure.docx
- Strategic_Objectives.pptx
- Cost_Breakdown.xlsx
- Technology_Roadmap.pdf
- General_Ledger.csv
- Data_Capability.docx
`;

  const conversationHistory = [
    { role: "user", content: "Can you explain the importance of the HRIS Report?" },
    { role: "assistant", content: "The HRIS Report provides key employee data and is essential for understanding workforce demographics and compensation." }
  ];

  try {
    const response = await generateChatCompletion(query, context, conversationHistory);
    console.log("AI Response:\n", response);
  } catch (error) {
    console.error("Error during chat completion:", error);
  }
}

main();