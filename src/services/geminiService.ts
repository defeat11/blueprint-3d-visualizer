import {
  buildPrecise3DPrompt,
  getPromptBlockingIssues,
  type PromptRoom,
} from "../utils/promptBuilder";

export function compilePromptInstruction(
  globalStyle: string,
  lighting: string,
  camera: string,
  layoutShape: string,
  workspaceWidth: number,
  workspaceLength: number,
  engine: string,
  rooms: PromptRoom[],
  imageBase64?: string,
  resolutionClause?: string,
) {
  void imageBase64;
  return buildPrecise3DPrompt(
    globalStyle,
    lighting,
    camera,
    layoutShape,
    workspaceWidth,
    workspaceLength,
    engine,
    rooms,
    resolutionClause,
  );
}

export async function generate3DPrompt(
  globalStyle: string,
  lighting: string,
  camera: string,
  layoutShape: string,
  workspaceWidth: number,
  workspaceLength: number,
  engine: string,
  rooms: PromptRoom[],
  imageBase64?: string,
  resolutionClause?: string,
) {
  void imageBase64;

  const issues = getPromptBlockingIssues(rooms, workspaceWidth, workspaceLength);
  if (issues.length > 0) {
    throw new Error(`لا يمكن توليد برومبت دقيق قبل إكمال البيانات:\n- ${issues.join("\n- ")}`);
  }

  return buildPrecise3DPrompt(
    globalStyle,
    lighting,
    camera,
    layoutShape,
    workspaceWidth,
    workspaceLength,
    engine,
    rooms,
    resolutionClause,
  );
}
