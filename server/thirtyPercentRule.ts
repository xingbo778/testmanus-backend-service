/**
 * 30% Rule Validator for Storyboard Scripts
 * 
 * The "30% Rule" is a professional storyboarding/editing principle:
 * Adjacent shots must differ by at least 30% in composition (shot type, angle,
 * subject position, scene) to avoid "jump cuts" that feel jarring to viewers.
 * 
 * This module validates scripts against this rule by checking:
 * 1. Shot type repetition (same shotType in consecutive frames)
 * 2. Camera movement repetition (same movement in consecutive frames)
 * 3. Description semantic similarity (similar content/scene in consecutive frames)
 * 4. Scene/location repetition patterns
 */

// ============================================================
// Types
// ============================================================

export interface FrameForValidation {
  index: number;
  shotType: string;
  duration: number;
  description: string;
  cameraMovement: string;
  notes?: string;
}

export type ViolationSeverity = "critical" | "warning" | "info";

export interface Violation {
  frameA: number;        // index of first frame
  frameB: number;        // index of second frame
  severity: ViolationSeverity;
  reason: string;
  details: {
    shotTypeMatch: boolean;
    cameraMatch: boolean;
    descriptionSimilarity: number;  // 0-1
    sharedKeywords: string[];
  };
}

export interface ValidationResult {
  isValid: boolean;
  totalViolations: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  violations: Violation[];
  summary: string;
}

// ============================================================
// Shot Type Grouping
// ============================================================

/**
 * Group shot types by visual similarity.
 * Shots in the same group look very similar when used consecutively.
 */
const SHOT_TYPE_GROUPS: Record<string, string> = {
  // Close-up group — ECU, BCU, CU, MCU are all visually close
  "ECU": "close",
  "BCU": "close",
  "CU": "close",
  "MCU": "close",
  // Medium group
  "MS": "medium",
  "MFS": "medium",
  // Full/Wide group
  "FS": "full",
  "MWS": "wide",
  "WS": "wide",
  "EWS": "extreme_wide",
  // Special
  "INS": "insert",
  "OTS": "over_shoulder",
  "POV": "point_of_view",
  "2S": "two_shot",
};

function getShotGroup(shotType: string): string {
  const upper = shotType.toUpperCase().trim();
  return SHOT_TYPE_GROUPS[upper] || upper.toLowerCase();
}

/**
 * Calculate how different two shot types are.
 * Returns 0 (identical) to 1 (completely different).
 */
function shotTypeDifference(a: string, b: string): number {
  const groupA = getShotGroup(a);
  const groupB = getShotGroup(b);
  
  if (groupA === groupB) return 0;
  
  // Define a distance scale
  const scale = ["close", "medium", "full", "wide", "extreme_wide"];
  const idxA = scale.indexOf(groupA);
  const idxB = scale.indexOf(groupB);
  
  if (idxA === -1 || idxB === -1) {
    // One is a special type (INS, OTS, POV, 2S) - always different enough
    return 0.8;
  }
  
  const distance = Math.abs(idxA - idxB);
  // 0 steps = 0, 1 step = 0.3, 2 steps = 0.6, 3+ steps = 1.0
  if (distance === 0) return 0;
  if (distance === 1) return 0.3;
  if (distance === 2) return 0.6;
  return 1.0;
}

// ============================================================
// Text Similarity (Keyword-based)
// ============================================================

/**
 * Extract meaningful keywords from a description.
 * Removes common stop words and short words.
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "shall",
    "should", "may", "might", "must", "can", "could", "of", "in", "to",
    "for", "with", "on", "at", "from", "by", "about", "as", "into",
    "through", "during", "before", "after", "above", "below", "between",
    "and", "but", "or", "nor", "not", "so", "yet", "both", "either",
    "neither", "each", "every", "all", "any", "few", "more", "most",
    "other", "some", "such", "no", "only", "own", "same", "than",
    "too", "very", "just", "because", "while", "if", "then", "that",
    "this", "these", "those", "it", "its", "he", "she", "they", "them",
    "his", "her", "their", "him", "who", "which", "what", "where",
    "when", "how", "up", "out", "off", "over", "under", "again",
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

/**
 * Calculate Jaccard similarity between two keyword sets.
 * Returns 0 (no overlap) to 1 (identical).
 */
function jaccardSimilarity(setA: string[], setB: string[]): number {
  if (setA.length === 0 && setB.length === 0) return 0;
  
  const a = new Set(setA);
  const b = new Set(setB);
  
  let intersection = 0;
  Array.from(a).forEach(word => {
    if (b.has(word)) intersection++;
  });
  
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Find shared keywords between two descriptions.
 */
function findSharedKeywords(descA: string, descB: string): string[] {
  const kwA = new Set(extractKeywords(descA));
  const kwB = extractKeywords(descB);
  return kwB.filter(w => kwA.has(w));
}

/**
 * Calculate description similarity using multiple signals:
 * 1. Keyword overlap (Jaccard)
 * 2. N-gram overlap (bigrams)
 * 3. Subject/scene detection
 */
function descriptionSimilarity(descA: string, descB: string): number {
  const kwA = extractKeywords(descA);
  const kwB = extractKeywords(descB);
  
  // 1. Keyword Jaccard similarity
  const jaccard = jaccardSimilarity(kwA, kwB);
  
  // 2. Bigram overlap
  const bigramsA = new Set<string>();
  const bigramsB = new Set<string>();
  for (let i = 0; i < kwA.length - 1; i++) bigramsA.add(`${kwA[i]} ${kwA[i + 1]}`);
  for (let i = 0; i < kwB.length - 1; i++) bigramsB.add(`${kwB[i]} ${kwB[i + 1]}`);
  
  let bigramOverlap = 0;
  if (bigramsA.size > 0 && bigramsB.size > 0) {
    let bigramIntersection = 0;
    Array.from(bigramsA).forEach(bg => {
      if (bigramsB.has(bg)) bigramIntersection++;
    });
    const bigramUnion = bigramsA.size + bigramsB.size - bigramIntersection;
    bigramOverlap = bigramUnion === 0 ? 0 : bigramIntersection / bigramUnion;
  }
  
  // 3. Check for same primary subject/character names
  // Extract capitalized words (likely character names or specific nouns)
  const namesA = new Set(descA.match(/[A-Z][a-z]{2,}/g) || []);
  const namesB = new Set(descB.match(/[A-Z][a-z]{2,}/g) || []);
  let nameOverlap = 0;
  if (namesA.size > 0 && namesB.size > 0) {
    let nameIntersection = 0;
    Array.from(namesA).forEach(n => {
      if (namesB.has(n)) nameIntersection++;
    });
    nameOverlap = nameIntersection / Math.max(namesA.size, namesB.size);
  }
  
  // Weighted combination
  return jaccard * 0.5 + bigramOverlap * 0.3 + nameOverlap * 0.2;
}

// ============================================================
// Main Validation
// ============================================================

/**
 * Validate a script against the 30% rule.
 * Checks all consecutive frame pairs for sufficient visual differentiation.
 */
export function validate30PercentRule(frames: FrameForValidation[]): ValidationResult {
  const violations: Violation[] = [];
  
  if (frames.length < 2) {
    return {
      isValid: true,
      totalViolations: 0,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      violations: [],
      summary: "Script has fewer than 2 frames, no adjacent pairs to check.",
    };
  }
  
  for (let i = 0; i < frames.length - 1; i++) {
    const frameA = frames[i];
    const frameB = frames[i + 1];
    
    const shotDiff = shotTypeDifference(frameA.shotType, frameB.shotType);
    const shotTypeMatch = shotDiff < 0.3; // Same or very similar shot type
    
    const cameraMatch = frameA.cameraMovement.toLowerCase().trim() === frameB.cameraMovement.toLowerCase().trim();
    
    const descSim = descriptionSimilarity(frameA.description, frameB.description);
    const sharedKw = findSharedKeywords(frameA.description, frameB.description);
    
    // Determine severity based on how many signals match
    let severity: ViolationSeverity | null = null;
    let reason = "";
    
    // CRITICAL: Same shot type + high description similarity (>0.5)
    // This is a classic jump cut
    if (shotTypeMatch && descSim > 0.5) {
      severity = "critical";
      reason = `Jump cut risk: Frames #${frameA.index}→#${frameB.index} have same shot type (${frameA.shotType}→${frameB.shotType}) AND very similar content (${(descSim * 100).toFixed(0)}% similar). ${sharedKw.length > 3 ? `Shared keywords: ${sharedKw.slice(0, 5).join(", ")}` : ""}`;
    }
    // CRITICAL: Same shot type + same camera movement + moderate similarity
    else if (shotTypeMatch && cameraMatch && descSim > 0.3) {
      severity = "critical";
      reason = `Triple match: Frames #${frameA.index}→#${frameB.index} have same shot type (${frameA.shotType}→${frameB.shotType}), same camera (${frameA.cameraMovement}), and similar content (${(descSim * 100).toFixed(0)}%).`;
    }
    // WARNING: Same shot type + moderate similarity
    else if (shotTypeMatch && descSim > 0.3) {
      severity = "warning";
      reason = `Shot type repetition: Frames #${frameA.index}→#${frameB.index} both use ${frameA.shotType} with ${(descSim * 100).toFixed(0)}% content similarity.`;
    }
    // WARNING: Different shot type but very high description similarity
    else if (descSim > 0.6) {
      severity = "warning";
      reason = `Content repetition: Frames #${frameA.index}→#${frameB.index} have ${(descSim * 100).toFixed(0)}% similar descriptions despite different shot types (${frameA.shotType}→${frameB.shotType}).`;
    }
    // INFO: Same shot type only (description is different enough)
    else if (shotTypeMatch && descSim > 0.15) {
      severity = "info";
      reason = `Same shot type: Frames #${frameA.index}→#${frameB.index} both use ${frameA.shotType}. Consider varying the shot type for visual rhythm.`;
    }
    
    if (severity) {
      violations.push({
        frameA: frameA.index,
        frameB: frameB.index,
        severity,
        reason,
        details: {
          shotTypeMatch,
          cameraMatch,
          descriptionSimilarity: Math.round(descSim * 100) / 100,
          sharedKeywords: sharedKw.slice(0, 10),
        },
      });
    }
  }
  
  // Also check for 3+ consecutive frames with the same shot type (always critical)
  for (let i = 0; i < frames.length - 2; i++) {
    const a = frames[i];
    const b = frames[i + 1];
    const c = frames[i + 2];
    
    if (getShotGroup(a.shotType) === getShotGroup(b.shotType) &&
        getShotGroup(b.shotType) === getShotGroup(c.shotType)) {
      // Check if we already have a violation for this triple
      const existingAB = violations.find(v => v.frameA === a.index && v.frameB === b.index);
      const existingBC = violations.find(v => v.frameA === b.index && v.frameB === c.index);
      
      // Upgrade both to critical if not already
      if (existingAB && existingAB.severity !== "critical") {
        existingAB.severity = "critical";
        existingAB.reason = `Triple consecutive ${a.shotType}: Frames #${a.index}→#${b.index}→#${c.index} all use the same shot type group. This creates a monotonous visual rhythm.`;
      }
      if (existingBC && existingBC.severity !== "critical") {
        existingBC.severity = "critical";
        existingBC.reason = `Triple consecutive ${b.shotType}: Frames #${a.index}→#${b.index}→#${c.index} all use the same shot type group. This creates a monotonous visual rhythm.`;
      }
      
      // If no existing violations for these pairs, add them
      if (!existingAB) {
        violations.push({
          frameA: a.index,
          frameB: b.index,
          severity: "critical",
          reason: `Triple consecutive ${a.shotType}: Frames #${a.index}→#${b.index}→#${c.index} all use the same shot type group.`,
          details: {
            shotTypeMatch: true,
            cameraMatch: false,
            descriptionSimilarity: descriptionSimilarity(a.description, b.description),
            sharedKeywords: findSharedKeywords(a.description, b.description).slice(0, 5),
          },
        });
      }
      if (!existingBC) {
        violations.push({
          frameA: b.index,
          frameB: c.index,
          severity: "critical",
          reason: `Triple consecutive ${c.shotType}: Frames #${a.index}→#${b.index}→#${c.index} all use the same shot type group.`,
          details: {
            shotTypeMatch: true,
            cameraMatch: false,
            descriptionSimilarity: descriptionSimilarity(b.description, c.description),
            sharedKeywords: findSharedKeywords(b.description, c.description).slice(0, 5),
          },
        });
      }
    }
  }
  
  // Deduplicate violations by frameA+frameB pair (keep highest severity)
  const deduped = new Map<string, Violation>();
  for (const v of violations) {
    const key = `${v.frameA}-${v.frameB}`;
    const existing = deduped.get(key);
    if (!existing || severityRank(v.severity) > severityRank(existing.severity)) {
      deduped.set(key, v);
    }
  }
  
  const finalViolations = Array.from(deduped.values()).sort((a, b) => a.frameA - b.frameA);
  const criticalCount = finalViolations.filter(v => v.severity === "critical").length;
  const warningCount = finalViolations.filter(v => v.severity === "warning").length;
  const infoCount = finalViolations.filter(v => v.severity === "info").length;
  
  const isValid = criticalCount === 0 && warningCount === 0;
  
  let summary = "";
  if (isValid && infoCount === 0) {
    summary = "All adjacent frame pairs pass the 30% rule. Good visual rhythm!";
  } else if (isValid) {
    summary = `Script passes with ${infoCount} minor suggestions for improvement.`;
  } else {
    summary = `Found ${criticalCount} critical and ${warningCount} warning violations of the 30% rule. ${criticalCount > 0 ? "Critical issues will likely result in jump cuts." : ""}`;
  }
  
  return {
    isValid,
    totalViolations: finalViolations.length,
    criticalCount,
    warningCount,
    infoCount,
    violations: finalViolations,
    summary,
  };
}

function severityRank(s: ViolationSeverity): number {
  switch (s) {
    case "critical": return 3;
    case "warning": return 2;
    case "info": return 1;
  }
}

// ============================================================
// Exports for testing
// ============================================================
export { extractKeywords, jaccardSimilarity, descriptionSimilarity, shotTypeDifference, getShotGroup };
