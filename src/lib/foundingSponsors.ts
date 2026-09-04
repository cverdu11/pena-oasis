export const FOUNDING_SPONSORS = [
  "Carlos Verdu",
  "Luis Perez",
  "Josemi Alarcon",
  "Jose Aciego",
  "Luis Alberto",
  "JD Honorato",
  "Julio Navarrete",
  "Gabriel Aciego",
  "Fali Sanchez",
  "Antonio Gonzalez",
  "Juanga Ruiz",
] as const;

export const INVALID_SPONSOR_MESSAGE =
  "El padrino no es válido. Introduce el nombre completo de uno de los socios fundadores.";
export const MISSING_SPONSOR_MESSAGE =
  "Introduce el nombre completo de tu padrino para poder registrarte.";

function normalizeSponsorName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-ES")
    .trim()
    .replace(/\s+/g, " ");
}

const SPONSORS_BY_NORMALIZED_NAME = new Map(
  FOUNDING_SPONSORS.map((name) => [normalizeSponsorName(name), name]),
);

export function getCanonicalFoundingSponsor(value: string) {
  return SPONSORS_BY_NORMALIZED_NAME.get(normalizeSponsorName(value)) ?? null;
}
