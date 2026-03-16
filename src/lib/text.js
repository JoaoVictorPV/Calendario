// Utilitários simples de texto (sem dependências)

/**
 * Remove acentos/diacríticos e normaliza para comparação.
 * Ex.: "Segunda-feira" -> "segunda-feira"
 */
export function normalizeText(input) {
  return (input ?? '')
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}
