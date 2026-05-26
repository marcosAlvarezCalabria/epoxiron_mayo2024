import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const customers = [
  {
    name: "Industrias Aretxaga",
    email: "compras@aretxaga.es",
    phone: "+34 944 120 301",
    address: "Pol. Ind. Ugaldeguren I, Parcela 12, Zamudio",
    notes: "Cliente industrial recurrente. Prioriza acabados anticorrosión.",
    pricePerLinearMeter: 12.5,
    pricePerSquareMeter: 28,
    minimumRate: 45,
    grosorMm: 3,
    grosorPrecio: 6,
    specialPieces: [
      { name: "Barandilla estándar", price: 48 },
      { name: "Marco reforzado", price: 62 }
    ]
  },
  {
    name: "Metalúrgica Rías Baixas",
    email: "oficina@metriasbaixas.com",
    phone: "+34 986 503 118",
    address: "Rua da Ponte 18, Mos, Pontevedra",
    notes: "Suelen trabajar colores RAL oscuros y series medias.",
    pricePerLinearMeter: 11,
    pricePerSquareMeter: 24.5,
    minimumRate: 38,
    grosorMm: 2.5,
    grosorPrecio: 4.5,
    specialPieces: [
      { name: "Perfil U 80", price: 21 },
      { name: "Soporte lateral", price: 16 }
    ]
  },
  {
    name: "Estructuras Levante 2000",
    email: "admin@levante2000.es",
    phone: "+34 961 772 450",
    address: "Camí Vell de Xirivella 44, Valencia",
    notes: "Pide entregas rápidas y revisión visual antes de salida.",
    pricePerLinearMeter: 13.2,
    pricePerSquareMeter: 30,
    minimumRate: 50,
    grosorMm: 4,
    grosorPrecio: 7,
    specialPieces: [
      { name: "Bastidor industrial", price: 95 },
      { name: "Rejilla técnica", price: 34 }
    ]
  },
  {
    name: "Talleres Sierra Norte",
    email: "pedidos@sierranorte.net",
    phone: "+34 918 444 902",
    address: "Av. del Encinar 7, Colmenar Viejo, Madrid",
    notes: "Mucho volumen en piezas pequeñas con tarifa mínima.",
    pricePerLinearMeter: 9.8,
    pricePerSquareMeter: 22,
    minimumRate: 32,
    grosorMm: 2,
    grosorPrecio: 3.5,
    specialPieces: [
      { name: "Tapa lateral", price: 9.5 },
      { name: "Pletina corta", price: 7.5 }
    ]
  },
  {
    name: "Carpintería Metálica Costa Sur",
    email: "info@costasurmetal.com",
    phone: "+34 956 811 223",
    address: "Ctra. Sanlúcar km 3, Jerez de la Frontera",
    notes: "Cliente de exteriores. Suele pedir suplementos por grosor.",
    pricePerLinearMeter: 14,
    pricePerSquareMeter: 31.5,
    minimumRate: 52,
    grosorMm: 3.5,
    grosorPrecio: 8,
    specialPieces: [
      { name: "Puerta peatonal", price: 110 },
      { name: "Poste reforzado", price: 42 }
    ]
  },
  {
    name: "Montajes del Cantábrico",
    email: "produccion@montajescantabrico.es",
    phone: "+34 942 204 117",
    address: "Barrio Raos, Nave 5, Santander",
    notes: "Trabajan lotes medianos para obra y mantenimiento.",
    pricePerLinearMeter: 10.7,
    pricePerSquareMeter: 25.8,
    minimumRate: 36,
    grosorMm: 3,
    grosorPrecio: 5.2,
    specialPieces: [
      { name: "Bandeja portacables", price: 18 },
      { name: "Soporte tubular", price: 14 }
    ]
  },
  {
    name: "Inox Aragón Técnica",
    email: "logistica@inoxaragon.es",
    phone: "+34 976 588 771",
    address: "Polígono Malpica, Calle F Oeste 23, Zaragoza",
    notes: "Exigen trazabilidad por lote y acabados consistentes.",
    pricePerLinearMeter: 15.5,
    pricePerSquareMeter: 33,
    minimumRate: 58,
    grosorMm: 4,
    grosorPrecio: 8.5,
    specialPieces: [
      { name: "Bastidor inoxidable", price: 125 },
      { name: "Cubre motor", price: 54 }
    ]
  },
  {
    name: "Soluciones Ferroviarias del Sur",
    email: "proyectos@sfsur.es",
    phone: "+34 954 667 810",
    address: "Parque Empresarial La Isla, Dos Hermanas, Sevilla",
    notes: "Piezas técnicas con bastante documentación y control visual.",
    pricePerLinearMeter: 16.2,
    pricePerSquareMeter: 35,
    minimumRate: 60,
    grosorMm: 4.5,
    grosorPrecio: 9,
    specialPieces: [
      { name: "Caja técnica", price: 88 },
      { name: "Soporte de cabina", price: 73 }
    ]
  }
] as const;

async function main() {
  await prisma.specialPiece.deleteMany();
  await prisma.deliveryNoteItem.deleteMany();
  await prisma.deliveryNote.deleteMany();
  await prisma.customer.deleteMany();

  for (const customer of customers) {
    await prisma.customer.create({
      data: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        notes: customer.notes,
        pricePerLinearMeter: customer.pricePerLinearMeter,
        pricePerSquareMeter: customer.pricePerSquareMeter,
        minimumRate: customer.minimumRate,
        grosorMm: customer.grosorMm,
        grosorPrecio: customer.grosorPrecio,
        specialPieces: {
          create: customer.specialPieces.map((piece) => ({
            name: piece.name,
            price: piece.price
          }))
        }
      }
    });
  }

  console.log(`Seed completado: ${customers.length} clientes creados.`);
}

main()
  .catch((error) => {
    console.error("Error ejecutando seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
