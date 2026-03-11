import { z } from "zod";
import { create, all } from "mathjs";

const math = create(all, {});

const allowedFunctions = new Set(["sqrt", "log", "sin", "cos", "tan", "abs", "ceil", "floor", "round", "exp"]);

const inputSchema = z.object({
  expression: z.string().min(1).max(200)
});

function validateExpression(expr) {
  const node = math.parse(expr);
  node.traverse((n) => {
    if (n.isSymbolNode) {
      if (!allowedFunctions.has(n.name)) {
        throw new Error(`Symbol not allowed: ${n.name}`);
      }
    }
    if (n.isFunctionNode) {
      if (!allowedFunctions.has(n.name)) {
        throw new Error(`Function not allowed: ${n.name}`);
      }
    }
    if (n.isOperatorNode || n.isParenthesisNode || n.isConstantNode) {
      return;
    }
  });
}

export const calculatorTool = {
  name: "calculator",
  description: "Safely evaluate a math expression.",
  inputSchema,
  riskLevel: "low",
  requiresApproval: false,
  async execute({ expression }) {
    validateExpression(expression);
    const result = math.evaluate(expression);
    return { expression, result };
  }
};