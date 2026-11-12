import { EngineSettings } from '../types';
import { Evaluation } from './types';

export function rankEligibleEvaluations(evaluations: Evaluation[], settings: EngineSettings): Evaluation[] {
  return evaluations
    .filter((evaluation) => evaluation.eligible && evaluation.score >= settings.minimumScore)
    .sort((a, b) => b.score - a.score || a.distanceMeters - b.distanceMeters);
}
