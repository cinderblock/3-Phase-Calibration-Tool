import ts from 'typescript';
import { Sources } from './Sources';

export function getCompiledSourcesFromProgram(program: ts.EmitAndSemanticDiagnosticsBuilderProgram): Sources {
  const data: Sources = [];

  // Grab all the compiled sources
  program.emit(undefined, (filename, source) => data.push({ filename, source }));

  return data;
}
