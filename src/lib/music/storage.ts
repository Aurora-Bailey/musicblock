import { browser } from '$app/environment';
import { LEGACY_STORAGE_KEYS, STORAGE_KEY } from './constants';
import { parseMusicBlock } from './parser';
import type { SavedPiece } from './types';
import { createId } from '$lib/utils/ids';

export function getPieces(): SavedPiece[] {
  if (!browser) return [];

  const raw = localStorage.getItem(STORAGE_KEY) ?? getLegacyStorageValue();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedPiece).map(hydrateSavedPiece).filter((piece): piece is SavedPiece => Boolean(piece));
  } catch (error) {
    console.warn('Could not parse saved Musicblock pieces.', error);
    return [];
  }
}

function hydrateSavedPiece(piece: SavedPiece): SavedPiece | null {
  if (!needsHydration(piece)) return piece;

  const parsed = parseMusicBlock(piece.sourceText);
  if (!parsed.ok) return hasRenderableScore(piece) ? piece : null;

  return {
    ...piece,
    composer: piece.composer ?? parsed.score.composer,
    score: {
      ...parsed.score,
      title: piece.title
    }
  };
}

function needsHydration(piece: SavedPiece): boolean {
  const firstTrebleMeasure = piece.score?.staves?.treble?.[0];
  if (!firstTrebleMeasure) return true;
  if (!Array.isArray(firstTrebleMeasure.voices)) return true;

  const rawTime = piece.score?.time?.raw;
  if (!rawTime) return true;

  const expectedMeasureUnits = rawTime === '4/4'
    ? 64
    : rawTime === '3/4'
      ? 48
      : rawTime === '2/4'
        ? 32
        : rawTime === '6/8'
          ? 48
          : null;

  return expectedMeasureUnits !== null && piece.score.time.measureUnits !== expectedMeasureUnits;
}

function hasRenderableScore(piece: SavedPiece): boolean {
  return Boolean(
    piece.score?.time
    && Array.isArray(piece.score?.staves?.treble)
    && Array.isArray(piece.score?.staves?.bass)
  );
}

export function savePieces(pieces: SavedPiece[]): void {
  if (!browser) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pieces));
}

export function savePiece(piece: SavedPiece): void {
  upsertPiece(piece);
}

export function getPiece(id: string): SavedPiece | null {
  return getPieces().find((piece) => piece.id === id) ?? null;
}

export function deletePiece(id: string): void {
  savePieces(getPieces().filter((piece) => piece.id !== id));
}

export function upsertPiece(piece: SavedPiece): void {
  const pieces = getPieces();
  const index = pieces.findIndex((existing) => existing.id === piece.id);

  if (index >= 0) {
    pieces[index] = piece;
  } else {
    pieces.push(piece);
  }

  savePieces(pieces);
}

export function duplicatePiece(id: string): SavedPiece | null {
  const source = getPiece(id);
  if (!source) return null;

  const now = new Date().toISOString();
  const duplicate: SavedPiece = {
    ...source,
    id: createId(),
    title: `${source.title} copy`,
    createdAt: now,
    updatedAt: now,
    score: {
      ...source.score,
      title: `${source.score.title} copy`
    }
  };

  upsertPiece(duplicate);
  return duplicate;
}

export function renamePiece(id: string, title: string): SavedPiece | null {
  const trimmed = title.trim();
  if (!trimmed) return null;

  const piece = getPiece(id);
  if (!piece) return null;

  const updated: SavedPiece = {
    ...piece,
    title: trimmed,
    updatedAt: new Date().toISOString(),
    score: {
      ...piece.score,
      title: trimmed
    }
  };

  upsertPiece(updated);
  return updated;
}

function isSavedPiece(value: unknown): value is SavedPiece {
  if (!value || typeof value !== 'object') return false;
  const piece = value as Partial<SavedPiece>;
  return (
    typeof piece.id === 'string'
    && typeof piece.title === 'string'
    && typeof piece.createdAt === 'string'
    && typeof piece.updatedAt === 'string'
    && typeof piece.sourceText === 'string'
    && typeof piece.score === 'object'
    && piece.score !== null
  );
}

function getLegacyStorageValue(): string | null {
  for (const key of LEGACY_STORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }

  return null;
}
