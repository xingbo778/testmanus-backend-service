import { describe, it, expect } from "vitest";
import { validate30PercentRule, type FrameForValidation } from "./thirtyPercentRule";

describe("30% Rule Validation", () => {
  it("should pass when frames have diverse shot types", () => {
    const frames: FrameForValidation[] = [
      { index: 1, shotType: "WS", duration: 2, description: "Wide establishing shot of a city skyline at dawn, golden light on buildings", cameraMovement: "static" },
      { index: 2, shotType: "MCU", duration: 2, description: "Close-up of a man's face, intense expression, dark alley background", cameraMovement: "dolly" },
      { index: 3, shotType: "CU", duration: 1.5, description: "Extreme close-up of a hand gripping a knife, sweat dripping", cameraMovement: "static" },
      { index: 4, shotType: "MS", duration: 2, description: "Medium shot of two people talking at a cafe table, warm interior", cameraMovement: "pan" },
    ];
    const result = validate30PercentRule(frames);
    expect(result.criticalCount).toBe(0);
  });

  it("should detect consecutive identical shot types as critical", () => {
    const frames: FrameForValidation[] = [
      { index: 1, shotType: "MCU", duration: 2, description: "Man speaking at desk, office background", cameraMovement: "static" },
      { index: 2, shotType: "MCU", duration: 2, description: "Woman responding, same office", cameraMovement: "static" },
      { index: 3, shotType: "MCU", duration: 2, description: "Man nodding, looking down", cameraMovement: "static" },
    ];
    const result = validate30PercentRule(frames);
    expect(result.criticalCount).toBeGreaterThanOrEqual(1);
    expect(result.isValid).toBe(false);
    // Should flag MCU→MCU consecutive pairs
    const criticals = result.violations.filter(v => v.severity === "critical");
    expect(criticals.length).toBeGreaterThan(0);
  });

  it("should detect similar adjacent shot type groups as warning", () => {
    const frames: FrameForValidation[] = [
      { index: 1, shotType: "CU", duration: 2, description: "Close-up of a woman's eyes, tears forming", cameraMovement: "static" },
      { index: 2, shotType: "MCU", duration: 2, description: "Medium close-up of the same woman, wiping tears", cameraMovement: "static" },
      { index: 3, shotType: "BCU", duration: 1.5, description: "Big close-up of her trembling lips", cameraMovement: "static" },
    ];
    const result = validate30PercentRule(frames);
    // CU→MCU→BCU are all in the close-up group
    const warnings = result.violations.filter(v => v.severity === "warning" || v.severity === "critical");
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("should detect high description similarity", () => {
    const frames: FrameForValidation[] = [
      { index: 1, shotType: "MS", duration: 2, description: "A man surfing on a large ocean wave, blue water, sunny day, tropical beach background", cameraMovement: "tracking" },
      { index: 2, shotType: "WS", duration: 2, description: "A man surfing on a large ocean wave, blue water, sunny day, tropical beach in the distance", cameraMovement: "static" },
    ];
    const result = validate30PercentRule(frames);
    // Even though shot types differ, descriptions are very similar
    const violations = result.violations.filter(v => v.details?.descriptionSimilarity > 0.5);
    expect(violations.length).toBeGreaterThan(0);
  });

  it("should return valid for empty or single frame", () => {
    expect(validate30PercentRule([]).isValid).toBe(true);
    expect(validate30PercentRule([
      { index: 1, shotType: "WS", duration: 2, description: "test", cameraMovement: "static" }
    ]).isValid).toBe(true);
  });

  it("should generate correct summary text", () => {
    const frames: FrameForValidation[] = [
      { index: 1, shotType: "MCU", duration: 2, description: "Person A talking", cameraMovement: "static" },
      { index: 2, shotType: "MCU", duration: 2, description: "Person B talking", cameraMovement: "static" },
    ];
    const result = validate30PercentRule(frames);
    expect(result.summary).toBeTruthy();
    expect(typeof result.summary).toBe("string");
  });

  it("should include frameA and frameB in each violation", () => {
    const frames: FrameForValidation[] = [
      { index: 1, shotType: "MCU", duration: 2, description: "Shot one", cameraMovement: "static" },
      { index: 2, shotType: "MCU", duration: 2, description: "Shot two", cameraMovement: "static" },
    ];
    const result = validate30PercentRule(frames);
    for (const v of result.violations) {
      expect(v.frameA).toBeDefined();
      expect(v.frameB).toBeDefined();
      expect(typeof v.frameA).toBe("number");
      expect(typeof v.frameB).toBe("number");
    }
  });

  it("should handle mixed Chinese and English descriptions", () => {
    const frames: FrameForValidation[] = [
      { index: 1, shotType: "WS", duration: 2, description: "Wide shot of 城市街道, neon lights, rain", cameraMovement: "crane" },
      { index: 2, shotType: "MCU", duration: 2, description: "Close-up of 主角 face, determined expression", cameraMovement: "static" },
    ];
    const result = validate30PercentRule(frames);
    // Should not crash on mixed language
    expect(result).toBeDefined();
    expect(result.totalViolations).toBeDefined();
  });

  it("should detect 3+ consecutive close-up group shots", () => {
    const frames: FrameForValidation[] = [
      { index: 1, shotType: "MS", duration: 2, description: "Medium shot establishing the room", cameraMovement: "static" },
      { index: 2, shotType: "MCU", duration: 2, description: "Person A close up talking", cameraMovement: "static" },
      { index: 3, shotType: "CU", duration: 1.5, description: "Person B reaction close up", cameraMovement: "static" },
      { index: 4, shotType: "MCU", duration: 2, description: "Person A continues talking", cameraMovement: "static" },
      { index: 5, shotType: "WS", duration: 2, description: "Wide shot of the entire room", cameraMovement: "pan" },
    ];
    const result = validate30PercentRule(frames);
    // Frames 2-3-4 are all close-up group (MCU, CU, MCU)
    expect(result.totalViolations).toBeGreaterThan(0);
  });
});
