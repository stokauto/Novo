export function brl(value) {
  if (value === null || value === undefined || value === "") return "Consultar valor";
  const n = Number(value);
  if (Number.isNaN(n)) return "Consultar valor";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

// Preço de veículo: trata null/undefined/""/0/negativo como "Consultar valor".
// Evita renderizar "R$ 0,00" como se fosse um valor válido no card/detalhe.
export function vehiclePrice(value) {
  if (value === null || value === undefined || value === "") return "Consultar valor";
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "Consultar valor";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

export function km(value) {
  if (value === null || value === undefined || value === "") return "—";
  return Number(value).toLocaleString("pt-BR") + " km";
}

export function digits(s) {
  return (s || "").replace(/\D+/g, "");
}

export function waLink(whatsapp, message) {
  const num = digits(whatsapp);
  const url = `https://wa.me/${num}`;
  if (message) return `${url}?text=${encodeURIComponent(message)}`;
  return url;
}

export const UF_LIST = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"
];

export const UF_STATES = [
  { code: "AC", name: "Acre" },
  { code: "AL", name: "Alagoas" },
  { code: "AP", name: "Amapá" },
  { code: "AM", name: "Amazonas" },
  { code: "BA", name: "Bahia" },
  { code: "CE", name: "Ceará" },
  { code: "DF", name: "Distrito Federal" },
  { code: "ES", name: "Espírito Santo" },
  { code: "GO", name: "Goiás" },
  { code: "MA", name: "Maranhão" },
  { code: "MT", name: "Mato Grosso" },
  { code: "MS", name: "Mato Grosso do Sul" },
  { code: "MG", name: "Minas Gerais" },
  { code: "PA", name: "Pará" },
  { code: "PB", name: "Paraíba" },
  { code: "PR", name: "Paraná" },
  { code: "PE", name: "Pernambuco" },
  { code: "PI", name: "Piauí" },
  { code: "RJ", name: "Rio de Janeiro" },
  { code: "RN", name: "Rio Grande do Norte" },
  { code: "RS", name: "Rio Grande do Sul" },
  { code: "RO", name: "Rondônia" },
  { code: "RR", name: "Roraima" },
  { code: "SC", name: "Santa Catarina" },
  { code: "SP", name: "São Paulo" },
  { code: "SE", name: "Sergipe" },
  { code: "TO", name: "Tocantins" },
];

export const TRANSMISSION_LABELS = { manual: "Manual", automatico: "Automático", automatizado: "Automatizado", cvt: "CVT" };
export const FUEL_LABELS = { flex: "Flex", gasolina: "Gasolina", alcool: "Álcool", diesel: "Diesel", gnv: "GNV", eletrico: "Elétrico", hibrido: "Híbrido" };
export function txLabel(v) { if (!v) return "—"; return TRANSMISSION_LABELS[String(v).toLowerCase()] || v; }
export function fuelLabel(v) { if (!v) return "—"; return FUEL_LABELS[String(v).toLowerCase()] || v; }
