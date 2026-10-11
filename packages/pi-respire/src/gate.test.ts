import { describe, it, expect } from "vitest";
import { RecallGate } from "../src/gate.js";

describe("RecallGate", () => {
  it("should start in CLOSED state", () => {
    const gate = new RecallGate();
    expect(gate.getState().status).toBe("CLOSED");
  });

  it("should block non-recall first tool call", () => {
    const gate = new RecallGate({ firstTool: "block" });
    const result = gate.checkFirstCall("read");
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("first tool call");
  });

  it("should allow recall as first tool call", () => {
    const gate = new RecallGate();
    const result = gate.checkFirstCall("respire_recall");
    
    expect(result.allowed).toBe(true);
    expect(gate.getState().status).toBe("PENDING");
  });

  it("should transition to OPEN after recall result", () => {
    const gate = new RecallGate();
    gate.checkFirstCall("respire_recall");
    gate.handleRecallResult(true);
    
    expect(gate.getState().status).toBe("OPEN");
  });

  it("should reset on new turn", () => {
    const gate = new RecallGate();
    gate.checkFirstCall("respire_recall");
    gate.handleRecallResult(true);
    expect(gate.getState().status).toBe("OPEN");
    
    gate.reset();
    expect(gate.getState().status).toBe("CLOSED");
  });

  it("should terminate after max blocks", () => {
    const gate = new RecallGate({ firstTool: "block", maxBlocks: 3 });
    
    gate.checkFirstCall("read");
    gate.reset();
    gate.checkFirstCall("write");
    gate.reset();
    const result = gate.checkFirstCall("edit");
    
    expect(gate.getState().blockedCount).toBe(3);
  });

  it("should recognize bash recall commands", () => {
    const gate = new RecallGate();
    const isRecall = gate.isRecallTool("bash", {
      command: 'rsrs recall "pi-bot memory" --json --titles',
    });
    
    expect(isRecall).toBe(true);
  });

  it("should not recognize bash without --json", () => {
    const gate = new RecallGate();
    const isRecall = gate.isRecallTool("bash", {
      command: "rsrs recall query",
    });
    
    expect(isRecall).toBe(false);
  });

  it("should handle error gate", () => {
    const gate = new RecallGate({ errorGate: "block" });
    gate.checkFirstCall("respire_recall");
    gate.handleRecallResult(true);
    
    gate.handleToolError("some_tool");
    expect(gate.getState().status).toBe("ERROR_GATE");
    
    const result = gate.checkAfterError("read");
    expect(result.allowed).toBe(false);
    
    const recallCheck = gate.checkAfterError("respire_recall");
    expect(recallCheck.allowed).toBe(true);
    expect(gate.getState().status).toBe("OPEN");
  });
});
