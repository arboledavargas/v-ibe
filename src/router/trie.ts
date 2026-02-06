import { RouteNode, FindResult, RouteCandidate } from "./trie.types";
import { Constructor } from "../DI/types";
import { Service } from "../DI/decorators/service";

@Service
export class Trie {
  private readonly root: RouteNode = this.createNode();
  private _maxDepth = 0;

  // 'insert' ahora acepta un id, loader, metadata, policies y slot.
  public insert(
    id: string,
    path: string,
    loader: () => Promise<any>,
    metadata?: Record<string, any>,
    policies?: Constructor<any>[],
    slot?: string
  ): void {
    const segments = path.split("/").filter(Boolean);
    let currentNode = this.root;

    // Trackear profundidad máxima
    // +1 porque candidatesByLevel incluye el root (nivel 0) + los segmentos
    this._maxDepth = Math.max(this._maxDepth, segments.length + 1);

    for (const segment of segments) {
      if (segment.startsWith(":")) {
        const paramName = segment.slice(1);
        if (!currentNode.dynamicChild) {
          currentNode.dynamicChild = this.createNode();
          currentNode.dynamicChild.paramName = paramName;
        }
        currentNode = currentNode.dynamicChild;
      } else {
        if (!currentNode.staticChildren.has(segment)) {
          currentNode.staticChildren.set(segment, this.createNode());
        }
        currentNode = currentNode.staticChildren.get(segment)!;
      }
    }

    // Agregar candidato al array en lugar de sobrescribir
    const candidate: RouteCandidate = {
      id,   // UUID único de la ruta
      path, // Guardar el path original de la ruta
      loader,
      metadata,
      policies,
      slot
    };


    if (!currentNode.candidates) {
      currentNode.candidates = [];
    }
    currentNode.candidates.push(candidate);
  }

  public find(path: string): FindResult | null {
    const segments = path.split("/").filter(Boolean);
    const params: Record<string, string> = {};
    const candidatesByLevel: RouteCandidate[][] = [];

    let currentNode = this.root;

    // Agregar candidatos del root (nivel 0) si existen
    if (currentNode.candidates && currentNode.candidates.length > 0) {
      candidatesByLevel.push([...currentNode.candidates]);
    }

    // Si la ruta es exactamente "/" (sin segmentos), retornamos solo el root
    if (segments.length === 0) {
      if (candidatesByLevel.length > 0) {
        return { candidatesByLevel, params };
      }
      return null;
    }

    // Para rutas con segmentos, navegamos y recolectamos candidatos en cada nivel
    for (const segment of segments) {
      if (currentNode.staticChildren.has(segment)) {
        currentNode = currentNode.staticChildren.get(segment)!;
      } else if (currentNode.dynamicChild) {
        currentNode = currentNode.dynamicChild;
        params[currentNode.paramName!] = segment;
      } else {
        return null; // No hay coincidencia
      }

      // Agregar candidatos de este nivel si existen
      if (currentNode.candidates && currentNode.candidates.length > 0) {
        candidatesByLevel.push([...currentNode.candidates]);
      }
    }

    // Solo devolvemos un resultado si encontramos al menos un candidato.
    if (candidatesByLevel.length > 0) {
      return {
        candidatesByLevel,
        params
      };
    }

    return null;
  }

  /**
   * Retorna la profundidad máxima de rutas registradas en el Trie
   * @returns Número de niveles (0 = solo root, 1 = un segmento, etc.)
   */
  public get maxDepth(): number {
    return this._maxDepth;
  }

  private createNode(): RouteNode {
    return { staticChildren: new Map() };
  }
}
